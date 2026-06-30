// Spielkonstanten – aligned with MIT Fish Banks values
export const GAME_CONFIG = {
  maxRunden: 20,
  startFischbestand: 4000,   // actual fish count
  maxFischbestand: 6000,
  wachstumsRate: 0.05,
  startGuthaben: 5000,
  initialBoote: 3,           // ships per team at start (MIT standard)
  bootKosten: 300,           // new ship order price (shipyard)
  auctionPreis: 500,         // auction market price for buying/selling ships
  bootVerkaufswert: 500,     // = auctionPreis
  fischPreis: 20,            // $/fish
  harborCost: 50,            // $/ship/round — Harbor (no catch, shelter cost)
  coastalCost: 150,          // $/ship/round — Coastal (max 15 fish/ship)
  deepSeaCost: 250,          // $/ship/round — Deep Sea (max 25 fish/ship)
  zinsRate: 0.02,            // 2%/round interest on minimum balance
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function clampBoote(value, max) {
  return Math.max(0, Math.min(max, Math.round(value)))
}

// ─── Core game functions ──────────────────────────────────────────────────────

// Logistic growth after total catch is removed.
export function berechneFischbestand(aktuellerBestand, gesamtFang, params) {
  const wachstum = (params?.fishReproductionRate ?? GAME_CONFIG.wachstumsRate)
    * aktuellerBestand
    * (1 - aktuellerBestand / (params?.maxFishPopulation ?? GAME_CONFIG.maxFischbestand))
  const neuerBestand = aktuellerBestand - gesamtFang + wachstum
  const maxFisch = params?.maxFishPopulation ?? GAME_CONFIG.maxFischbestand
  return Math.min(maxFisch, Math.max(0, Math.round(neuerBestand)))
}

// Per-team catch: ships × zoneMaxEff × sqrt(density).
export function berechneFang(ausgesandteBoote, fischbestand, params) {
  if (ausgesandteBoote === 0) return 0
  const maxFisch = params?.maxFishPopulation ?? GAME_CONFIG.maxFischbestand
  const fischDichte = fischbestand / maxFisch
  return Math.round(ausgesandteBoote * 25 * Math.sqrt(Math.max(0, fischDichte)))
}

// Weather factor for one round (±10%), applied to catch per MIT spec.
export function erzeugeMarktereignis() {
  return rand(0.90, 1.10)
}

export function berechneNetWorth(bankBalance, boote, shipPrice) {
  return bankBalance + (boote * shipPrice)
}

// ─── AI helpers ───────────────────────────────────────────────────────────────

// Average fish change per round over the last 3 rounds (negative = declining).
function berechneTrend(verlauf) {
  if (verlauf.length < 2) return 0
  const recent = verlauf.slice(-3)
  let delta = 0
  for (let i = 1; i < recent.length; i++) {
    delta += recent[i].fischbestand - recent[i - 1].fischbestand
  }
  return delta / (recent.length - 1)
}

// ─── Easy AI ─────────────────────────────────────────────────────────────────
//
// Reasonable but imperfect: uses current fish stock, 20% chance of suboptimal
// zone choice, orders max 1 ship/round from shipyard when conditions allow.
// Scales with game progress so it doesn't expand in the late game.
//
// Returns { harborShips, coastalShips, deepSeaShips,
//           shipsToBuy, shipsToSell, newShipOrders }

export function kiDecisionEasy(team, gameState, params) {
  const { fleet, bankBalance } = team
  const { fischbestand, runde, maxRunden, marketShipPrice } = gameState
  const maxFisch = params?.maxFishPopulation ?? GAME_CONFIG.maxFischbestand
  const auctionPrice = marketShipPrice ?? GAME_CONFIG.auctionPreis
  const newShipPrice = params?.newShipPrice ?? GAME_CONFIG.bootKosten

  const density = fischbestand / maxFisch
  const maxRoundsVal = maxRunden ?? GAME_CONFIG.maxRunden
  const gameProgress = runde / maxRoundsVal

  // Ship buying: max 1/round, only if stock healthy and in first 55% of game
  const shipsToBuy = (density > 0.65 && gameProgress < 0.55 && bankBalance >= auctionPrice) ? 1 : 0

  // Ship selling: only if stock has dropped below 25%
  const shipsToSell = (density < 0.25 && fleet > 1) ? 1 : 0

  // Shipyard ordering: 1 ship/round when stock healthy and in first 70% of game
  const newShipOrders = (
    density > 0.65 &&
    gameProgress < 0.70 &&
    (team.shipsInDelivery || 0) === 0 &&
    bankBalance > newShipPrice * 2
  ) ? 1 : 0

  // Zone allocation on effective fleet (fleet after applying buy/sell)
  const effectiveFleet = Math.max(1, fleet + shipsToBuy - shipsToSell)
  let harborShips, coastalShips, deepSeaShips

  if (density > 0.65) {
    // Prefer Deep Sea (70 %), Coastal (30 %)
    deepSeaShips = Math.round(effectiveFleet * 0.7)
    coastalShips = effectiveFleet - deepSeaShips
    harborShips = 0
  } else if (density >= 0.4) {
    // Even split Coastal / Deep Sea
    deepSeaShips = Math.floor(effectiveFleet / 2)
    coastalShips = effectiveFleet - deepSeaShips
    harborShips = 0
  } else {
    // Prefer Coastal, keep 1 ship in Harbor
    harborShips = Math.min(1, effectiveFleet)
    coastalShips = effectiveFleet - harborShips
    deepSeaShips = 0
  }

  // 20 % chance of a suboptimal zone choice
  if (Math.random() < 0.2 && effectiveFleet > 1) {
    if (deepSeaShips > 0) { deepSeaShips--; harborShips++ }
    else if (coastalShips > 0) { coastalShips--; harborShips++ }
  }

  return { harborShips, coastalShips, deepSeaShips, shipsToBuy, shipsToSell, newShipOrders }
}

// ─── Hard AI ─────────────────────────────────────────────────────────────────
//
// Near-optimal: deploys all ships to the highest-profit zone, calculates ROI
// before buying/ordering ships, tracks fish trend and other teams' deployment.
//
// Returns { harborShips, coastalShips, deepSeaShips,
//           shipsToBuy, shipsToSell, newShipOrders }

export function kiDecisionHard(team, gameState, params) {
  const { fleet, bankBalance } = team
  const { fischbestand, runde, maxRunden, verlauf, marketShipPrice } = gameState
  const maxFisch = params?.maxFishPopulation ?? GAME_CONFIG.maxFischbestand
  const fishPrice = params?.fishPrice ?? GAME_CONFIG.fischPreis
  const auctionPrice = marketShipPrice ?? GAME_CONFIG.auctionPreis
  const newShipPrice = params?.newShipPrice ?? GAME_CONFIG.bootKosten
  const harborCost = params?.harborCost ?? GAME_CONFIG.harborCost   // eslint-disable-line no-unused-vars
  const coastalCost = params?.coastalCost ?? GAME_CONFIG.coastalCost
  const deepSeaCost = params?.deepSeaCost ?? GAME_CONFIG.deepSeaCost

  const density = fischbestand / maxFisch
  const sqrtDensity = Math.sqrt(Math.max(0, density))
  const maxRoundsVal = maxRunden ?? GAME_CONFIG.maxRunden
  const roundsRemaining = Math.max(1, maxRoundsVal - runde + 1)
  const gameProgress = runde / maxRoundsVal

  // Expected profit per ship per round in each zone
  const coastalProfit = (15 * sqrtDensity * fishPrice) - coastalCost
  const deepSeaProfit = (25 * sqrtDensity * fishPrice) - deepSeaCost
  const bestZoneProfit = Math.max(coastalProfit, deepSeaProfit)

  // Fish trend: average change per round over last 3 rounds
  const fishTrend = berechneTrend(verlauf)

  // Rapid decline: avg loss > 100 fish/round over last 3 rounds
  const rapidDecline = fishTrend < -100

  // Expected profit per ship over all remaining rounds
  const expectedProfitPerShip = bestZoneProfit * roundsRemaining

  // Ship buying (auction – instant, max 1 per round)
  let shipsToBuy = 0
  if (
    density > 0.60 &&
    gameProgress < 0.50 &&
    expectedProfitPerShip > auctionPrice * 1.5 &&
    bankBalance > auctionPrice * 2
  ) {
    shipsToBuy = 1
  }

  // Ship selling (instant) – ship is a net liability, or late-game rapid decline
  let shipsToSell = 0
  if (bestZoneProfit < 0 && auctionPrice > 150 && fleet > 1) {
    shipsToSell = 1
    shipsToBuy = 0   // never buy and sell simultaneously
  }
  if (rapidDecline && gameProgress > 0.70 && fleet > 1 && shipsToSell === 0) {
    shipsToSell = 1
    shipsToBuy = 0
  }

  // New ship orders (shipyard – arrives next round, max 1 to prevent runaway expansion)
  let newShipOrders = 0
  if (
    density > 0.55 &&
    gameProgress < 0.65 &&
    (team.shipsInDelivery || 0) === 0 &&
    bankBalance > newShipPrice * 3 &&
    !rapidDecline
  ) {
    newShipOrders = 1
  }

  // Zone allocation on effective fleet (after buy/sell)
  const effectiveFleet = Math.max(1, fleet + shipsToBuy - shipsToSell)

  // Reduce deployment to 60% when stock is declining rapidly
  const deployedCount = rapidDecline ? Math.max(1, Math.round(effectiveFleet * 0.6)) : effectiveFleet

  let harborShips, coastalShips, deepSeaShips

  if (deepSeaProfit >= coastalProfit) {
    deepSeaShips = clampBoote(deployedCount * rand(0.95, 1.05), effectiveFleet)
    coastalShips = 0
    harborShips = effectiveFleet - deepSeaShips
  } else if (coastalProfit > 0) {
    coastalShips = clampBoote(deployedCount * rand(0.95, 1.05), effectiveFleet)
    deepSeaShips = 0
    harborShips = effectiveFleet - coastalShips
  } else {
    // Both zones unprofitable – harbor all ships to minimize losses
    harborShips = effectiveFleet
    coastalShips = 0
    deepSeaShips = 0
  }
  harborShips = Math.max(0, harborShips)

  return { harborShips, coastalShips, deepSeaShips, shipsToBuy, shipsToSell, newShipOrders }
}

// ─── AI Marketplace Participation ──────────────────────────────────────────
//
// Beyond the instant emergency buy/sell handled above (capped at 2/round,
// premium/discount pricing), AI teams also react to the player-driven ship
// marketplace: they bid on listings other teams put up for sale, and list
// their own surplus ships when conditions call for offloading more than the
// emergency cap allows — at a much better price than a distress sale.
// Shared by both single-player simulation and the multiplayer server so AI
// behaves identically in both modes.

// Decides whether an AI team bids on an open listing, and for how much.
// Returns a bid amount (>= listing.askingPrice, > listing.topBid) or null to pass.
export function kiAuctionBidDecision(team, listing, gameState, params) {
  if (!listing || listing.status !== 'open') return null

  const { fischbestand, runde, maxRunden, marketShipPrice } = gameState
  const maxFisch = params?.maxFishPopulation ?? GAME_CONFIG.maxFischbestand
  const density = maxFisch > 0 ? Math.max(0, fischbestand) / maxFisch : 0
  const maxRoundsVal = maxRunden ?? GAME_CONFIG.maxRunden
  const gameProgress = runde / maxRoundsVal
  const refPrice = marketShipPrice ?? GAME_CONFIG.auctionPreis
  const isHard = team.aiDifficulty === 'hard'

  if (density < 0.30) return null                              // fishery too thin to expand into
  if (gameProgress > (isHard ? 0.60 : 0.55)) return null        // too late to bother
  if ((team.fleet ?? 0) >= 10) return null                      // avoid runaway hoarding
  if (team.bankBalance < listing.askingPrice) return null

  // Easy AI is reactive and imperfect — sometimes just doesn't bother
  if (!isHard && Math.random() < 0.45) return null

  const ceilingMultiplier = isHard ? 1.15 : 1.0
  const densityBonus = (isHard ? 0.10 : 0.05) * density
  const maxWillingToPay = Math.round(refPrice * (ceilingMultiplier + densityBonus))

  const currentTop = listing.topBid ?? (listing.askingPrice - 1)
  const step = Math.max(10, Math.round(refPrice * 0.02))
  const nextBid = Math.max(listing.askingPrice, currentTop + step)

  if (nextBid > maxWillingToPay) return null
  if (nextBid > team.bankBalance) return null
  return nextBid
}

// Decides whether an AI team should list surplus ships on the marketplace.
// Returns { ships, askingPrice } or null.
export function kiListingDecision(team, gameState, params) {
  const { fischbestand, marketShipPrice } = gameState
  const maxFisch = params?.maxFishPopulation ?? GAME_CONFIG.maxFischbestand
  const density = maxFisch > 0 ? Math.max(0, fischbestand) / maxFisch : 0
  const refPrice = marketShipPrice ?? GAME_CONFIG.auctionPreis
  const isHard = team.aiDifficulty === 'hard'

  if ((team.fleet ?? 0) <= 2) return null

  const densityThreshold = isHard ? 0.40 : 0.35
  if (density >= densityThreshold) return null

  const askingPrice = Math.round(refPrice * (isHard ? 0.85 : 0.90) / 10) * 10
  return { ships: 1, askingPrice }
}
