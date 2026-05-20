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

// Zone cost/effectiveness lookup by personality.
// Greedy → Deep Sea, Cooperative → Coastal, Rational → Deep Sea (optimal at high density).
function getZoneParams(persoenlichkeit, params) {
  const deepSeaCost = params?.deepSeaCost ?? GAME_CONFIG.deepSeaCost
  const coastalCost = params?.coastalCost ?? GAME_CONFIG.coastalCost
  if (persoenlichkeit === 'kooperativ') return { zoneCost: coastalCost, zoneMaxEff: 15 }
  return { zoneCost: deepSeaCost, zoneMaxEff: 25 }
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

// Per-team catch: ships × zoneMaxEff × sqrt(density). Used for AI decisions.
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

// ─── Leicht ──────────────────────────────────────────────────────────────────

export function kiBootAktionLeicht(team, verkaufPreis = GAME_CONFIG.bootVerkaufswert, params) {
  const { fleet: boote, bankBalance: guthaben } = team
  const newShipCost = params?.newShipPrice ?? GAME_CONFIG.bootKosten
  const r = Math.random()
  if (r > 0.93 && guthaben >= newShipCost && boote < 7) {
    return { fleet: boote + 1, bankBalance: guthaben - newShipCost }
  }
  if (r < 0.04 && boote > 2) {
    return { fleet: boote - 1, bankBalance: guthaben + verkaufPreis }
  }
  return { fleet: boote, bankBalance: guthaben }
}

export function kiAusgesandtLeicht(boote) {
  return clampBoote(boote * rand(0.10, 0.70), boote)
}

// ─── Schwer ──────────────────────────────────────────────────────────────────

function berechneTrend(verlauf) {
  if (verlauf.length < 2) return 0
  const recent = verlauf.slice(-3)
  let delta = 0
  for (let i = 1; i < recent.length; i++) {
    delta += recent[i].fischbestand - recent[i - 1].fischbestand
  }
  return delta / (recent.length - 1)
}

// Grid-search: find profit-maximising boat count for a given zone.
function bestResponse(meineMaxBoote, fischbestand, params, zoneCost, zoneMaxEff) {
  const maxFisch = params?.maxFishPopulation ?? GAME_CONFIG.maxFischbestand
  const fischPreis = params?.fishPrice ?? GAME_CONFIG.fischPreis
  const fischDichte = fischbestand / maxFisch
  const eff = zoneMaxEff * Math.sqrt(Math.max(0, fischDichte))
  let bestBoote = 0
  let bestGewinn = 0
  for (let b = 1; b <= meineMaxBoote; b++) {
    const gewinn = b * eff * fischPreis - b * zoneCost
    if (gewinn > bestGewinn) {
      bestGewinn = gewinn
      bestBoote = b
    }
  }
  return bestBoote
}

function andereBooteGeschaetzt(meineTeamName, alleTeams) {
  return alleTeams
    .filter(t => t.name !== meineTeamName)
    .reduce((sum, t) => sum + (t.ausgesandteBoote || 3), 0)
}

export function kiBootAktionSchwer(team, fischbestand, verlauf, alleTeams, verkaufPreis = GAME_CONFIG.bootVerkaufswert, params) {
  let { fleet: boote, bankBalance: guthaben, persoenlichkeit, name } = team
  const trend = berechneTrend(verlauf)
  const maxFisch = params?.maxFishPopulation ?? GAME_CONFIG.maxFischbestand
  const fischPreis = params?.fishPrice ?? GAME_CONFIG.fischPreis
  const newShipCost = params?.newShipPrice ?? GAME_CONFIG.bootKosten
  const { zoneCost, zoneMaxEff } = getZoneParams(persoenlichkeit, params)

  // Panic selling: 8% chance when trend sharply negative and stock < 40%
  if (trend < maxFisch * -0.05 && fischbestand < maxFisch * 0.4 && boote > 3 && Math.random() < 0.08) {
    return { fleet: boote - 1, bankBalance: guthaben + verkaufPreis }
  }

  function expectedProfit(meineBoote) {
    if (meineBoote === 0) return 0
    const opt = bestResponse(meineBoote, fischbestand, params, zoneCost, zoneMaxEff)
    const fischDichte = fischbestand / maxFisch
    const meinFang = opt * zoneMaxEff * Math.sqrt(Math.max(0, fischDichte))
    return meinFang * fischPreis - opt * zoneCost
  }

  const marginalROI = (expectedProfit(boote + 1) - expectedProfit(boote)) * rand(0.85, 1.15)
  const kaufSchwelle = (persoenlichkeit === 'gierig' ? 30 : persoenlichkeit === 'rational' ? 150 : 250) * rand(0.90, 1.10)
  const verkaufTrendSchwelle = persoenlichkeit === 'kooperativ' ? maxFisch * -0.03 : persoenlichkeit === 'rational' ? maxFisch * -0.05 : maxFisch * -0.08

  if (marginalROI > kaufSchwelle && guthaben >= newShipCost && fischbestand > maxFisch * 0.35 && trend >= maxFisch * -0.02 && boote < 10) {
    boote += 1
    guthaben -= newShipCost
  } else if (trend < verkaufTrendSchwelle && boote > 3) {
    boote -= 1
    guthaben += verkaufPreis
  }

  return { fleet: boote, bankBalance: guthaben }
}

// Zone allocation for AI teams based on personality and fish density.
export function kiZoneAllokierung(persoenlichkeit, boote, ausgesandt, fischbestand, params) {
  const harbor = boote - ausgesandt
  if (persoenlichkeit === 'gierig') {
    return { harborShips: harbor, coastalShips: 0, deepSeaShips: ausgesandt }
  } else if (persoenlichkeit === 'kooperativ') {
    return { harborShips: harbor, coastalShips: ausgesandt, deepSeaShips: 0 }
  } else { // rational — 1 in Harbor, split rest by density
    const adjustedHarbor = Math.max(harbor, Math.min(1, boote))
    const remaining = boote - adjustedHarbor
    const maxFisch = params?.maxFishPopulation ?? GAME_CONFIG.maxFischbestand
    const fishDichte = fischbestand / maxFisch
    if (fishDichte > 0.5) {
      return { harborShips: adjustedHarbor, coastalShips: 0, deepSeaShips: remaining }
    } else {
      return { harborShips: adjustedHarbor, coastalShips: remaining, deepSeaShips: 0 }
    }
  }
}

export function kiAusgesandtSchwer(persoenlichkeit, teamName, boote, fischbestand, verlauf, alleTeams, params) {
  const trend = berechneTrend(verlauf)
  const maxFisch = params?.maxFishPopulation ?? GAME_CONFIG.maxFischbestand
  const { zoneCost, zoneMaxEff } = getZoneParams(persoenlichkeit, params)

  let optimal = bestResponse(boote, fischbestand, params, zoneCost, zoneMaxEff)

  if (persoenlichkeit === 'gierig') {
    optimal = Math.min(boote, optimal + 1)
  } else if (persoenlichkeit === 'kooperativ' && trend < maxFisch * -0.03) {
    optimal = Math.max(0, optimal - 1)
  }

  optimal = Math.round(optimal * rand(0.90, 1.10))

  if (fischbestand < maxFisch * 0.15) {
    optimal = Math.min(optimal, Math.max(0, Math.floor(boote * 0.2)))
  }

  return Math.max(0, Math.min(boote, optimal))
}
