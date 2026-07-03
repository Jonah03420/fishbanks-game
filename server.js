import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
import {
  GAME_CONFIG,
  berechneFischbestand,
  erzeugeMarktereignis,
  berechneNetWorth,
  kiDecisionEasy,
  kiDecisionHard,
  kiAuctionBidDecision,
  kiListingDecision,
} from './src/game/fishLogic.js'

const PORT = process.env.PORT || 3002
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

const app = express()
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())

const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
})

// ─── Room Management ──────────────────────────────────────────────────────────

const rooms = new Map()

// ─── Listing Timers ───────────────────────────────────────────────────────────

const listingTimers = new Map() // key: `${roomCode}:${listingId}` → timeoutId
const aiEvalTimers = new Map()  // key: `${roomCode}:${listingId}` → timeoutId (debounced AI bid reaction)

function clearListingTimer(roomCode, listingId) {
  const key = `${roomCode}:${listingId}`
  const id = listingTimers.get(key)
  if (id != null) { clearTimeout(id); listingTimers.delete(key) }
}

function clearAIEvalTimer(roomCode, listingId) {
  const key = `${roomCode}:${listingId}`
  const id = aiEvalTimers.get(key)
  if (id != null) { clearTimeout(id); aiEvalTimers.delete(key) }
}

// Applies a validated bid to a listing (used by both human place-bid and AI reactions).
function applyBid(room, roomCode, listing, slotIndex, bid) {
  const bidder = room.gameState.teams[slotIndex]
  if (!bidder) return

  listing.bids[slotIndex] = bid
  listing.topBid = bid
  listing.topBidderSlot = slotIndex
  listing.topBidderName = bidder.name

  const TIMER_MS = 20000
  clearListingTimer(roomCode, listing.id)
  listing.timerEndsAt = Date.now() + TIMER_MS
  const timerId = setTimeout(() => resolveListing(roomCode, listing.id), TIMER_MS)
  listingTimers.set(`${roomCode}:${listing.id}`, timerId)

  room.lastActivity = Date.now()
  io.to(roomCode).emit('listings-updated', { listings: room.gameState.auctionListings, teams: room.gameState.teams })
}

// AI teams react to listing activity (new listings / human or AI bids) after a short,
// human-like delay. Debounced per listing so rapid-fire bids don't stack timers, and
// capped so AI can't keep an auction open forever — humans always get the final word.
const AI_BID_CAP_PER_LISTING = 3

function scheduleAIBidEvaluation(room, roomCode, listingId) {
  const key = `${roomCode}:${listingId}`
  clearAIEvalTimer(roomCode, listingId)
  const delay = 1800 + Math.random() * 3200 // 1.8–5s, feels like a real player reacting
  const timerId = setTimeout(() => {
    aiEvalTimers.delete(key)
    evaluateAIBids(room, roomCode, listingId)
  }, delay)
  aiEvalTimers.set(key, timerId)
}

function evaluateAIBids(room, roomCode, listingId) {
  if (room.phase !== 'game' || !room.gameState) return
  const gs = room.gameState
  const listing = (gs.auctionListings || []).find(l => l.id === listingId)
  if (!listing || listing.status !== 'open') return
  if ((listing.aiBidCount || 0) >= AI_BID_CAP_PER_LISTING) return

  let bestSlot = -1
  let bestBid = -1
  gs.teams.forEach((team, idx) => {
    if (idx === listing.sellerSlot || idx === listing.topBidderSlot || !team.istKI) return
    const bid = kiAuctionBidDecision(team, listing, gs, gs.params)
    if (bid != null && bid > bestBid) { bestBid = bid; bestSlot = idx }
  })

  if (bestSlot === -1) return
  listing.aiBidCount = (listing.aiBidCount || 0) + 1
  applyBid(room, roomCode, listing, bestSlot, bestBid)
  console.log(`AI bid on ${listingId} in room ${roomCode}: ${bestBid}€ by slot ${bestSlot}`)

  // Give other AI (or a human) a chance to react to this bid
  scheduleAIBidEvaluation(room, roomCode, listingId)
}

// AI teams list surplus ships on the marketplace when fish stock is thin —
// a slower, better-priced alternative to the instant distress sale.
function createAIListings(room) {
  const gs = room.gameState
  const newListings = []
  gs.teams.forEach((team, idx) => {
    if (!team.istKI) return
    const decision = kiListingDecision(team, gs, gs.params)
    if (!decision) return
    const count = Math.min(decision.ships, Math.max(0, team.fleet - 1))
    if (count <= 0) return

    team.fleet -= count
    team.netWorth = berechneNetWorth(team.bankBalance, team.fleet, gs.marketShipPrice)

    const listing = {
      id: `${room.code}-ai-${idx}-${gs.runde}-${Date.now()}`,
      sellerSlot: idx,
      sellerName: team.name,
      sellerFarbe: team.farbe,
      ships: count,
      askingPrice: decision.askingPrice,
      bids: {},
      topBid: null,
      topBidderSlot: null,
      topBidderName: null,
      status: 'open',
      timerEndsAt: null,
      passedBy: [],
      resolution: null,
      aiBidCount: 0,
    }
    gs.auctionListings.push(listing)
    newListings.push(listing)
  })
  return newListings
}

function resolveListing(roomCode, listingId) {
  const room = rooms.get(roomCode)
  if (!room?.gameState) return
  const gs = room.gameState
  const listing = (gs.auctionListings || []).find(l => l.id === listingId)
  if (!listing || listing.status !== 'open') return

  clearListingTimer(roomCode, listingId)
  clearAIEvalTimer(roomCode, listingId)
  listing.timerEndsAt = null

  const seller = gs.teams[listing.sellerSlot]
  const buyer = listing.topBidderSlot != null ? gs.teams[listing.topBidderSlot] : null
  const qualifying = buyer != null
    && listing.topBid != null
    && listing.topBid >= listing.askingPrice

  if (!gs.listingEvents) gs.listingEvents = []

  if (qualifying) {
    seller.bankBalance += listing.topBid
    buyer.fleet += listing.ships
    buyer.bankBalance -= listing.topBid
    seller.netWorth = berechneNetWorth(seller.bankBalance, seller.fleet, gs.marketShipPrice)
    buyer.netWorth  = berechneNetWorth(buyer.bankBalance,  buyer.fleet,  gs.marketShipPrice)
    listing.status = 'sold'
    listing.resolution = { buyerName: buyer.name, price: listing.topBid }
    gs.listingEvents.push({ erfolg: true, sellerName: seller?.name || '?', kaeufer: buyer.name, preis: listing.topBid, ships: listing.ships })
    if (!gs.auctionHistory) gs.auctionHistory = []
    gs.auctionHistory.push({ runde: gs.runde, sellerName: seller?.name || '?', kaeufer: buyer.name, preis: listing.topBid, ships: listing.ships })
  } else {
    if (seller) {
      seller.fleet += listing.ships
      seller.netWorth = berechneNetWorth(seller.bankBalance, seller.fleet, gs.marketShipPrice)
    }
    listing.status = 'returned'
    listing.resolution = null
    gs.listingEvents.push({ erfolg: false, sellerName: seller?.name || '?', ships: listing.ships })
  }

  room.lastActivity = Date.now()
  io.to(roomCode).emit('listings-updated', { listings: gs.auctionListings, teams: gs.teams })
  console.log(`Listing ${listingId} resolved in room ${roomCode}: ${listing.status}`)
}

const SLOT_COLORS = ['red', 'yellow', 'green', 'blue', 'purple', 'orange']

const SLOT_COLOR_EMOJI = {
  red: '🔴', yellow: '🟡', green: '🟢',
  blue: '🔵', purple: '🟣', orange: '🟠'
}

const AI_NAMES = [
  'Captain AI', 'Fleet Admiral', 'Sea Bot', 'Ocean AI',
  'Wave Runner', 'Deep Diver'
]

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // excludes I and O
  let code
  do {
    code = Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')
  } while (rooms.has(code))
  return code
}

function createDefaultSettings(overrides = {}) {
  return {
    maxRounds: overrides.maxRounds ?? 20,
    numTeams: overrides.numTeams ?? 4,
    aiDifficulty: overrides.aiDifficulty ?? 'easy',
    startingBalance: overrides.startingBalance ?? GAME_CONFIG.startGuthaben,
    startingFleet: overrides.startingFleet ?? GAME_CONFIG.initialBoote,
    fishPrice: overrides.fishPrice ?? GAME_CONFIG.fischPreis,
    newShipPrice: overrides.newShipPrice ?? GAME_CONFIG.bootKosten,
    auctionPrice: overrides.auctionPrice ?? GAME_CONFIG.auctionPreis,
    interestRate: overrides.interestRate ?? GAME_CONFIG.zinsRate,
    maxFishPopulation: overrides.maxFishPopulation ?? GAME_CONFIG.maxFischbestand,
    startingFish: overrides.startingFish ?? GAME_CONFIG.startFischbestand,
    reproductionRate: overrides.reproductionRate ?? GAME_CONFIG.wachstumsRate,
    operatingCosts: {
      harbor: GAME_CONFIG.harborCost,
      coastal: GAME_CONFIG.coastalCost,
      deepSea: GAME_CONFIG.deepSeaCost,
      ...overrides.operatingCosts
    }
  }
}

function buildSlots(numTeams, hostSocketId, hostName, aiDifficulty) {
  const slots = []
  // Slot 0: host (human)
  slots.push({
    slotIndex: 0,
    name: hostName,
    socketId: hostSocketId,
    isAI: false,
    aiDifficulty,
    color: SLOT_COLORS[0],
    isConnected: true,
    joinedAt: Date.now()
  })
  // Remaining slots: AI teams
  for (let i = 1; i < numTeams; i++) {
    slots.push({
      slotIndex: i,
      name: AI_NAMES[i] || `AI Team ${i + 1}`,
      socketId: null,
      isAI: true,
      aiDifficulty,
      color: SLOT_COLORS[i],
      isConnected: false,
      joinedAt: Date.now()
    })
  }
  return slots
}

// Remove socketId and internal server fields before sending to clients
function sanitizeRoom(room) {
  const { pendingDecisions: _pd, ...rest } = room
  return {
    ...rest,
    slots: room.slots.map(slot => ({
      ...slot,
      socketId: undefined,
      disconnectedName: undefined,
    }))
  }
}

function hasHumanPlayers(room) {
  return room.slots.some(s => !s.isAI && s.socketId !== null)
}

// ─── HTTP Endpoints ───────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  let connections = 0
  rooms.forEach(room => {
    room.slots.forEach(s => { if (!s.isAI && s.isConnected) connections++ })
  })
  res.json({
    status: 'ok',
    rooms: rooms.size,
    connections,
    uptime: Math.floor(process.uptime())
  })
})

app.get('/rooms', (_req, res) => {
  res.json({ count: rooms.size })
})

// ─── Validation Helpers ───────────────────────────────────────────────────────

function validatePlayerName(name) {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 20
}

function validateRoomCode(code) {
  return typeof code === 'string' && /^[A-Z]{4}$/.test(code)
}

function validateSettings(s) {
  if (!s || typeof s !== 'object') return {}
  const out = {}
  if ([10, 15, 20].includes(s.maxRounds)) out.maxRounds = s.maxRounds
  if (typeof s.numTeams === 'number' && s.numTeams >= 2 && s.numTeams <= 6) out.numTeams = s.numTeams
  if (['easy', 'hard'].includes(s.aiDifficulty)) out.aiDifficulty = s.aiDifficulty
  return out
}

// ─── Game State Init ──────────────────────────────────────────────────────────

function initGameState(room) {
  const s = room.settings

  const params = {
    fishPrice: s.fishPrice,
    newShipPrice: s.newShipPrice,
    interestRate: s.interestRate,
    harborCost: s.operatingCosts.harbor,
    coastalCost: s.operatingCosts.coastal,
    deepSeaCost: s.operatingCosts.deepSea,
    maxFishPopulation: s.maxFishPopulation,
    startingFishStock: s.startingFish,
    fishReproductionRate: s.reproductionRate,
    // Informationsasymmetrie-Schalter: konzipiert, aber nicht an die UI
    // angebunden — vgl. Abschnitt 4.4 (Ausblick) der Arbeit. GamePage.jsx
    // wertet beide Flags bereits aus (Fischbestand/andere Fangergebnisse
    // ausblenden), sie sind hier aber fest auf "sichtbar" verdrahtet, da
    // validateSettings()/update-settings sie aktuell nicht entgegennimmt.
    showFishStock: true,
    showOtherCatches: true,
  }

  const teams = room.slots.map((slot, idx) => ({
    id: idx + 1,
    name: slot.name,
    farbe: SLOT_COLOR_EMOJI[slot.color] || '⚪',
    fleet: s.startingFleet,
    bankBalance: s.startingBalance,
    netWorth: s.startingBalance + s.startingFleet * s.auctionPrice,
    ausgesandteBoote: 0,
    harborShips: 0,
    coastalShips: 0,
    deepSeaShips: 0,
    letzterFang: 0,
    letzteZinsen: 0,
    shipsInDelivery: 0,
    auctionPurchases: 0,
    istKI: slot.isAI,
    aiDifficulty: slot.isAI ? s.aiDifficulty : null,
    isRealHuman: !slot.isAI,
    instantBuyCount: 0,
    instantSellCount: 0,
  }))

  return {
    runde: 1,
    fischbestand: s.startingFish,
    phase: 'entscheidung',
    maxRunden: s.maxRounds,
    schwierigkeitsgrad: s.aiDifficulty,
    marketShipPrice: s.auctionPrice,
    auctionHistory: [],
    pendingAuctionOffers: [],
    auctionListings: [],
    listingEvents: [],
    teams,
    verlauf: [],
    params,
  }
}

// ─── Round Processing ─────────────────────────────────────────────────────────
// Autoritative, serverseitige Rundenverarbeitung — vgl. Abschnitt 4.3 der
// Arbeit. Läuft in fester, numerierter Abfolge (Client-seitige Kopien, z. B.
// simuliereRunde() in GamePage.jsx, sind reine Dev-Fallbacks und müssen bei
// Änderungen hier manuell nachgezogen werden):
//   1. Offene Auktionen/Listings der Vorrunde abschließen (auktionsähnlicher
//      Marktplatz, siehe Codeabschnitt vor Step 1 unten)
//   2. Bestellte Schiffe aus der Vorrunde ausliefern                    (Step 1)
//   3. Soforthandel (Emergency Buy/Distress Sale), Betriebskosten,
//      Fangerlös — je Team, mit laufender Verfolgung des Mindestkontostands
//                                                                (Step 3–5)
//   4. Zinsberechnung auf den niedrigsten Kontostand der Runde           (Step 6)
//   5. Neubestellungen prüfen (Limit, Bausperre letzte Runde) und abbuchen
//                                                                        (Step 7)
//   6. Fischbestand fortschreiben (logistisches Wachstum)                (Step 8)
//   7. Marktpreis fortschreiben und Net Worth aller Teams neu berechnen
//                                                                (Step 9–10)
//   Danach: Rundensnapshot in verlauf sichern (Step 11) und Spielende
//   prüfen → 'game-ended' bzw. 'round-complete' senden (Step 12).

function processRound(room) {
  const gs = room.gameState
  const { params } = gs
  if (!room.pendingDecisions) room.pendingDecisions = {}

  // Record pre-auction balances so per-team auction income/expense can be tracked
  const preAuctionBalances = gs.teams.map(t => t.bankBalance)

  // Settle any listings still open when round fires — honor qualifying bids
  if (!gs.listingEvents) gs.listingEvents = []
  for (const listing of (gs.auctionListings || [])) {
    if (listing.status === 'open') {
      clearListingTimer(room.code, listing.id)
      clearAIEvalTimer(room.code, listing.id)
      listing.timerEndsAt = null

      const seller = gs.teams[listing.sellerSlot]
      const buyer  = listing.topBidderSlot != null ? gs.teams[listing.topBidderSlot] : null
      const qualifying = buyer != null
        && listing.topBid != null
        && listing.topBid >= listing.askingPrice

      if (qualifying) {
        seller.bankBalance += listing.topBid
        buyer.fleet += listing.ships
        buyer.bankBalance -= listing.topBid
        seller.netWorth = berechneNetWorth(seller.bankBalance, seller.fleet, gs.marketShipPrice)
        buyer.netWorth  = berechneNetWorth(buyer.bankBalance,  buyer.fleet,  gs.marketShipPrice)
        listing.status = 'sold'
        listing.resolution = { buyerName: buyer.name, price: listing.topBid }
        gs.listingEvents.push({ erfolg: true, sellerName: seller?.name || '?', kaeufer: buyer.name, preis: listing.topBid, ships: listing.ships })
        if (!gs.auctionHistory) gs.auctionHistory = []
        gs.auctionHistory.push({ runde: gs.runde, sellerName: seller?.name || '?', kaeufer: buyer.name, preis: listing.topBid, ships: listing.ships })
      } else {
        if (seller) {
          seller.fleet += listing.ships
          seller.netWorth = berechneNetWorth(seller.bankBalance, seller.fleet, gs.marketShipPrice)
        }
        listing.status = 'returned'
        listing.resolution = null
        gs.listingEvents.push({ erfolg: false, sellerName: seller?.name || '?', ships: listing.ships })
      }
    }
  }
  gs.auctionListings = [] // fresh slate for the next round

  // Per-team auction deltas (positive = income from selling, stored by index)
  const teamAuctionIncome = gs.teams.map((t, i) => Math.max(0,  t.bankBalance - preAuctionBalances[i]))
  const teamAuctionSpent  = gs.teams.map((t, i) => Math.max(0, preAuctionBalances[i] - t.bankBalance))

  const wetterfaktor = erzeugeMarktereignis()
  let totalCatch = 0

  // Step 1: Deliver ships ordered last round
  const roundDeliveries = []
  for (const team of gs.teams) {
    if (team.shipsInDelivery > 0) {
      roundDeliveries.push({ name: team.name, farbe: team.farbe, count: team.shipsInDelivery })
    }
    team.fleet += team.shipsInDelivery
    team.shipsInDelivery = 0
  }

  // Step 2: AI decisions (computed after delivery so fleet is up to date)
  for (let i = 0; i < gs.teams.length; i++) {
    const team = gs.teams[i]
    if (!team.istKI) continue
    const fn = team.aiDifficulty === 'hard' ? kiDecisionHard : kiDecisionEasy
    room.pendingDecisions[i] = fn(team, gs, params)
  }

  // Reset per-round instant buy/sell counts
  for (const team of gs.teams) {
    team.instantBuyCount  = 0
    team.instantSellCount = 0
  }

  // Steps 3–7: Per-team processing
  const aiShipPurchases = []

  for (let i = 0; i < gs.teams.length; i++) {
    const team = gs.teams[i]
    const dec  = room.pendingDecisions[i]
    if (!dec) continue

    // Step 3: Emergency Buy / Distress Sale — vgl. Abschnitt 4.2 der Arbeit.
    // Sofortiger, garantierter Kauf/Verkauf außerhalb der verhandelten
    // Auktion: Emergency Buy zu einem Aufpreis von 50% auf den aktuellen
    // Marktpreis, Distress Sale zu einem Abschlag von 50%. Transaktionslimit:
    // max. 2 Käufe UND max. 2 Verkäufe pro Team und Runde (instantBuyCount /
    // instantSellCount, unten pro Runde zurückgesetzt).
    const emergencyBuyPrice  = Math.round(gs.marketShipPrice * 1.5 / 10) * 10
    const distressSalePrice  = Math.round(gs.marketShipPrice * 0.5 / 10) * 10
    if (!team.instantBuyCount)  team.instantBuyCount  = 0
    if (!team.instantSellCount) team.instantSellCount = 0
    const toBuy  = Math.min(Math.max(0, dec.shipsToBuy  ?? 0), Math.max(0, 2 - team.instantBuyCount))
    const toSell = Math.min(Math.min(Math.max(0, dec.shipsToSell ?? 0), team.fleet), Math.max(0, 2 - team.instantSellCount))
    const quickBuyCost    = toBuy  * emergencyBuyPrice
    const quickSellIncome = toSell * distressSalePrice
    team.fleet  += toBuy - toSell
    team.auctionPurchases = toBuy
    team.bankBalance -= quickBuyCost
    team.bankBalance += quickSellIncome
    team.instantBuyCount  += toBuy
    team.instantSellCount += toSell

    if (team.istKI && toBuy > 0) {
      aiShipPurchases.push({ name: team.name, farbe: team.farbe, count: toBuy, price: emergencyBuyPrice })
    }

    // startBalance = balance after auction, before op costs (matches client roundSummary)
    const startBalance = team.bankBalance
    let balance    = startBalance
    let minBalance = balance

    // Step 4: Operating costs per zone
    const harbor  = Math.max(0, dec.harborShips  ?? 0)
    const coastal = Math.max(0, dec.coastalShips  ?? 0)
    const deep    = Math.max(0, dec.deepSeaShips  ?? 0)
    const opCosts = harbor  * params.harborCost
                  + coastal * params.coastalCost
                  + deep    * params.deepSeaCost
    balance   -= opCosts
    minBalance = Math.min(minBalance, balance)

    // Step 5: Fish catch + revenue
    const density      = Math.max(0, gs.fischbestand) / params.maxFishPopulation
    const sqrtDensity  = Math.sqrt(density)
    const coastalCatch = Math.round(coastal * 15 * sqrtDensity * wetterfaktor)
    const deepCatch    = Math.round(deep    * 25 * sqrtDensity * wetterfaktor)
    const teamCatch    = coastalCatch + deepCatch
    const fishRevenue  = Math.round(teamCatch * params.fishPrice)
    balance           += fishRevenue
    totalCatch        += teamCatch

    team.letzterFang      = teamCatch
    team.harborShips      = harbor
    team.coastalShips     = coastal
    team.deepSeaShips     = deep
    team.ausgesandteBoote = coastal + deep

    // Step 6: Interest on minimum balance — +2% reward if positive, −5% penalty if negative
    const effectiveRate = minBalance >= 0 ? params.interestRate : 0.05
    const zinsen    = Math.round(minBalance * effectiveRate)
    balance        += zinsen
    team.letzteZinsen = zinsen

    // Step 7: New ship orders — payment immediate, delivery next round
    const maxOrder     = gs.runde >= gs.maxRunden ? 0 : Math.ceil(team.fleet / 2)
    const actualOrders = Math.min(Math.max(0, dec.newShipOrders ?? 0), maxOrder)
    const orderCost    = actualOrders * params.newShipPrice
    balance           -= orderCost
    team.shipsInDelivery = actualOrders
    team.bankBalance     = balance

    // Attach roundSummary for the round result modal
    team.roundSummary = {
      startBalance,
      auctionSaleIncome: teamAuctionIncome[i] ?? 0,
      auctionBuyCost:    teamAuctionSpent[i]  ?? 0,
      quickBuyCost,
      quickSellIncome,
      opCosts,
      deployedShips: team.fleet,
      harborShips: harbor,
      coastalShips: coastal,
      deepSeaShips: deep,
      coastalFang: coastalCatch,
      deepSeaFang: deepCatch,
      fang: teamCatch,
      wetterfaktor,
      fishRevenue,
      minBalance,
      zinsen,
      actualOrder: actualOrders,
      orderCost,
      newShipPrice: params.newShipPrice,
      finalBalance: balance,
    }
  }

  // Step 8: Update fish stock — logistic growth after total catch removed
  const fischbestandVor = gs.fischbestand
  gs.fischbestand = berechneFischbestand(gs.fischbestand, totalCatch, params)

  // Step 9: Marktpreis-Fortschreibung — vgl. Abschnitt 4.2 der Arbeit. Gab es
  // in dieser Runde erfolgreiche Auktionsverkäufe, bewegt sich der Marktpreis
  // gewichtet (40/60) in Richtung des durchschnittlich erzielten
  // Auktionspreises. Ohne Verkäufe richtet er sich stattdessen nach Angebot/
  // Nachfrage anhand der Gesamtflottengröße aller Teams (>15 Schiffe → −5%,
  // <9 Schiffe → +5%). In beiden Fällen auf [150€, 1500€] begrenzt.
  const auctionSales = (gs.listingEvents || []).filter(e => e.erfolg)
  if (auctionSales.length > 0) {
    const totalRevenue   = auctionSales.reduce((s, e) => s + e.preis * (e.ships || 1), 0)
    const totalShipsSold = auctionSales.reduce((s, e) => s + (e.ships || 1), 0)
    const avgPrice = totalRevenue / totalShipsSold
    gs.marketShipPrice = Math.max(150, Math.min(1500, Math.round((gs.marketShipPrice * 0.4 + avgPrice * 0.6) / 10) * 10))
  } else {
    const totalShips = gs.teams.reduce((s, t) => s + t.fleet, 0)
    if (totalShips > 15) gs.marketShipPrice = Math.round(gs.marketShipPrice * 0.95 / 10) * 10
    else if (totalShips < 9) gs.marketShipPrice = Math.round(gs.marketShipPrice * 1.05 / 10) * 10
    gs.marketShipPrice = Math.max(150, Math.min(1500, gs.marketShipPrice))
  }

  // Step 10: Recalculate net worth for all teams
  for (const team of gs.teams) {
    team.netWorth = berechneNetWorth(team.bankBalance, team.fleet, gs.marketShipPrice)
  }

  // Step 11: Save round snapshot to verlauf with all fields GamePage expects.
  // fischbestand = pre-round value (matches client simuliereRunde convention) so
  // FishGraph and the Fishery Data table work identically in single-player and multiplayer.
  const verlaufEintrag = {
    runde: gs.runde,
    fischbestand: fischbestandVor,
    gesamtFang: totalCatch,
    wetterfaktor,
    wachstum: gs.fischbestand - fischbestandVor + totalCatch,
    marketShipPrice: gs.marketShipPrice,
  }
  for (const team of gs.teams) {
    verlaufEintrag[team.name]           = Math.round(team.netWorth)
    verlaufEintrag[`${team.name}_rs`]   = team.roundSummary
  }
  gs.verlauf.push(verlaufEintrag)

  // Attach top-level round data for the round result modal
  gs.letzterWetterfaktor  = wetterfaktor
  gs.letzterGesamtFang    = totalCatch
  gs.letzteAuktionEvents  = []
  gs.letzteListingEvents  = gs.listingEvents || []
  gs.listingEvents        = []
  gs.roundDeliveries      = roundDeliveries
  gs.aiShipPurchases      = aiShipPurchases

  // Step 12: Game end — max rounds reached or fish stock collapsed
  const isOver = gs.runde >= gs.maxRunden || gs.fischbestand <= 0

  // AI teams put surplus ships up on the marketplace for the upcoming decision phase
  // (skip when the game just ended — there's no further phase to bid in)
  if (!isOver) {
    const newAIListings = createAIListings(room)
    for (const listing of newAIListings) {
      scheduleAIBidEvaluation(room, room.code, listing.id)
    }
  }

  room.pendingDecisions = {}
  room.lastActivity = Date.now()

  if (isOver) {
    gs.phase = 'ende'
    room.phase = 'ended'
    io.to(room.code).emit('game-ended', { gameState: gs })
    console.log(`Game ended in room ${room.code} (round ${gs.runde}, fish: ${gs.fischbestand})`)
  } else {
    gs.runde++
    gs.phase = 'entscheidung'
    io.to(room.code).emit('round-complete', { gameState: gs })
    console.log(`Round ${gs.runde - 1} complete in room ${room.code}, fish: ${gs.fischbestand}`)
  }
}

// ─── Socket Events ────────────────────────────────────────────────────────────

io.on('connection', socket => {
  // ── create-room ────────────────────────────────────────────────────────────
  socket.on('create-room', ({ playerName, settings } = {}) => {
    if (!validatePlayerName(playerName)) {
      socket.emit('error', { code: 'INVALID_NAME', message: 'Player name must be 1–20 characters.' })
      return
    }

    const validatedSettings = validateSettings(settings || {})
    const mergedSettings = createDefaultSettings(validatedSettings)

    const roomCode = generateRoomCode()
    const now = Date.now()

    const room = {
      code: roomCode,
      host: socket.id,
      phase: 'lobby',
      createdAt: now,
      lastActivity: now,
      settings: mergedSettings,
      slots: buildSlots(
        mergedSettings.numTeams,
        socket.id,
        playerName.trim(),
        mergedSettings.aiDifficulty
      ),
      gameState: null,
      pendingDecisions: {},
    }

    rooms.set(roomCode, room)
    socket.join(roomCode)

    socket.emit('room-created', {
      roomCode,
      slotIndex: 0,
      room: sanitizeRoom(room)
    })

    console.log(`Room ${roomCode} created by ${playerName.trim()}`)
  })

  // ── join-room ───────────────────────────────────────────────────────────────
  socket.on('join-room', ({ playerName, roomCode } = {}) => {
    if (!validatePlayerName(playerName)) {
      socket.emit('error', { code: 'INVALID_NAME', message: 'Player name must be 1–20 characters.' })
      return
    }

    const code = typeof roomCode === 'string' ? roomCode.toUpperCase() : ''
    if (!validateRoomCode(code)) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found.' })
      return
    }

    const room = rooms.get(code)
    if (!room) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found.' })
      return
    }

    if (room.phase !== 'lobby') {
      socket.emit('error', { code: 'GAME_IN_PROGRESS', message: 'Game already started.' })
      return
    }

    const aiSlot = room.slots.find(s => s.isAI)
    if (!aiSlot) {
      socket.emit('error', { code: 'ROOM_FULL', message: 'No open slots.' })
      return
    }

    aiSlot.name = playerName.trim()
    aiSlot.socketId = socket.id
    aiSlot.isAI = false
    aiSlot.isConnected = true
    aiSlot.joinedAt = Date.now()
    room.lastActivity = Date.now()

    socket.join(code)

    socket.emit('room-joined', {
      slotIndex: aiSlot.slotIndex,
      room: sanitizeRoom(room)
    })

    io.to(code).emit('room-updated', { room: sanitizeRoom(room) })

    console.log(`${playerName.trim()} joined room ${code} as slot ${aiSlot.slotIndex}`)
  })

  // ── leave-room ──────────────────────────────────────────────────────────────
  socket.on('leave-room', ({ roomCode } = {}) => {
    handleLeave(socket, roomCode, true) // voluntary
  })

  // ── update-settings ─────────────────────────────────────────────────────────
  socket.on('update-settings', ({ roomCode, settings } = {}) => {
    const code = typeof roomCode === 'string' ? roomCode.toUpperCase() : ''
    const room = rooms.get(code)
    if (!room) return

    if (room.host !== socket.id) {
      socket.emit('error', { code: 'NOT_HOST', message: 'Only the host can change settings.' })
      return
    }

    const prev = room.settings
    const incoming = settings || {}

    if ([10, 15, 20].includes(incoming.maxRounds)) prev.maxRounds = incoming.maxRounds
    if (typeof incoming.numTeams === 'number' && incoming.numTeams >= 2 && incoming.numTeams <= 6) {
      const oldCount = prev.numTeams
      const newCount = incoming.numTeams
      prev.numTeams = newCount

      if (newCount > oldCount) {
        for (let i = oldCount; i < newCount; i++) {
          room.slots.push({
            slotIndex: i,
            name: AI_NAMES[i] || `AI Team ${i + 1}`,
            socketId: null,
            isAI: true,
            aiDifficulty: prev.aiDifficulty,
            color: SLOT_COLORS[i],
            isConnected: false,
            joinedAt: Date.now()
          })
        }
      } else if (newCount < oldCount) {
        room.slots.slice(newCount).forEach(slot => {
          if (!slot.isAI && slot.socketId) {
            const kickedSocket = io.sockets.sockets.get(slot.socketId)
            if (kickedSocket) {
              kickedSocket.leave(code)
              kickedSocket.emit('kicked', { reason: 'Slot removed by host.' })
            }
          }
        })
        room.slots = room.slots.slice(0, newCount)
        room.slots.forEach((s, i) => { s.slotIndex = i })
      }
    }
    if (['easy', 'hard'].includes(incoming.aiDifficulty)) prev.aiDifficulty = incoming.aiDifficulty
    if (typeof incoming.startingBalance === 'number') prev.startingBalance = incoming.startingBalance
    if (typeof incoming.startingFleet === 'number') prev.startingFleet = incoming.startingFleet
    if (typeof incoming.fishPrice === 'number') prev.fishPrice = incoming.fishPrice
    if (typeof incoming.newShipPrice === 'number') prev.newShipPrice = incoming.newShipPrice
    if (typeof incoming.auctionPrice === 'number') prev.auctionPrice = incoming.auctionPrice
    if (typeof incoming.interestRate === 'number') prev.interestRate = incoming.interestRate
    if (typeof incoming.maxFishPopulation === 'number') prev.maxFishPopulation = incoming.maxFishPopulation
    if (typeof incoming.startingFish === 'number') prev.startingFish = incoming.startingFish
    if (typeof incoming.reproductionRate === 'number') prev.reproductionRate = incoming.reproductionRate
    if (incoming.operatingCosts && typeof incoming.operatingCosts === 'object') {
      Object.assign(prev.operatingCosts, incoming.operatingCosts)
    }

    room.lastActivity = Date.now()
    io.to(code).emit('room-updated', { room: sanitizeRoom(room) })
  })

  // ── start-game ───────────────────────────────────────────────────────────────
  socket.on('start-game', ({ roomCode } = {}) => {
    const code = typeof roomCode === 'string' ? roomCode.toUpperCase() : ''
    const room = rooms.get(code)
    if (!room) return

    if (room.host !== socket.id) {
      socket.emit('error', { code: 'NOT_HOST', message: 'Only the host can start the game.' })
      return
    }
    if (room.phase !== 'lobby') {
      socket.emit('error', { code: 'ALREADY_STARTED', message: 'Game already started.' })
      return
    }

    room.gameState = initGameState(room)
    room.phase = 'game'
    room.pendingDecisions = {}
    room.lastActivity = Date.now()

    // Send each connected human their own slotIndex so the client never relies
    // on a potentially-stale closure value.
    for (const slot of room.slots) {
      if (!slot.isAI && slot.socketId) {
        const s = io.sockets.sockets.get(slot.socketId)
        if (s) s.emit('game-started', { gameState: room.gameState, slotIndex: slot.slotIndex })
      }
    }
    console.log(`Game started in room ${code} with ${room.slots.length} teams`)
  })

  // ── submit-decision ──────────────────────────────────────────────────────────
  socket.on('submit-decision', ({ roomCode, decision } = {}) => {
    const code = typeof roomCode === 'string' ? roomCode.toUpperCase() : ''
    const room = rooms.get(code)
    if (!room || room.phase !== 'game' || !room.gameState) return

    const slot = room.slots.find(s => s.socketId === socket.id)
    if (!slot || slot.isAI) return

    // Sanitize and store decision
    const dec = {
      harborShips:   Math.max(0, parseInt(decision?.harborShips)   || 0),
      coastalShips:  Math.max(0, parseInt(decision?.coastalShips)  || 0),
      deepSeaShips:  Math.max(0, parseInt(decision?.deepSeaShips)  || 0),
      shipsToBuy:    Math.max(0, parseInt(decision?.shipsToBuy)    || 0),
      shipsToSell:   Math.max(0, parseInt(decision?.shipsToSell)   || 0),
      newShipOrders: Math.max(0, parseInt(decision?.newShipOrders) || 0),
    }
    room.pendingDecisions[slot.slotIndex] = dec

    const humanSlots     = room.slots.filter(s => !s.isAI && s.socketId)
    const submittedCount = humanSlots.filter(s => room.pendingDecisions[s.slotIndex] !== undefined).length

    io.to(code).emit('decision-received', {
      slotIndex: slot.slotIndex,
      submitted: submittedCount,
      total: humanSlots.length
    })

    console.log(`Decision from slot ${slot.slotIndex} in room ${code} (${submittedCount}/${humanSlots.length})`)

    if (submittedCount === humanSlots.length) {
      try {
        processRound(room)
      } catch (err) {
        console.error(`processRound error in room ${code}:`, err)
        // Reset pending decisions so players can retry
        room.pendingDecisions = {}
        io.to(code).emit('round-error', { message: 'Server error processing round. Please resubmit.' })
      }
    }
  })

  // ── create-listing ──────────────────────────────────────────────────────────
  socket.on('create-listing', ({ roomCode, ships, askingPrice } = {}) => {
    const code = typeof roomCode === 'string' ? roomCode.toUpperCase() : ''
    const room = rooms.get(code)
    if (!room || room.phase !== 'game' || !room.gameState) return
    const slot = room.slots.find(s => s.socketId === socket.id)
    if (!slot || slot.isAI) return

    const team = room.gameState.teams[slot.slotIndex]
    if (!team) return
    const count = Math.max(1, parseInt(ships) || 1)
    const price = Math.max(1, parseInt(askingPrice) || 1)
    if (team.fleet - count < 1) return // must keep ≥1 ship

    team.fleet -= count
    team.netWorth = berechneNetWorth(team.bankBalance, team.fleet, room.gameState.marketShipPrice)

    const listing = {
      id: `${code}-${slot.slotIndex}-${Date.now()}`,
      sellerSlot: slot.slotIndex,
      sellerName: team.name,
      sellerFarbe: team.farbe,
      ships: count,
      askingPrice: price,
      bids: {},
      topBid: null,
      topBidderSlot: null,
      topBidderName: null,
      status: 'open',
      timerEndsAt: null,
      passedBy: [],
      resolution: null,
      aiBidCount: 0,
    }
    if (!room.gameState.auctionListings) room.gameState.auctionListings = []
    room.gameState.auctionListings.push(listing)
    room.lastActivity = Date.now()

    io.to(code).emit('listings-updated', { listings: room.gameState.auctionListings, teams: room.gameState.teams })
    console.log(`Listing ${listing.id} created in room ${code}`)
    scheduleAIBidEvaluation(room, code, listing.id)
  })

  // ── place-bid ───────────────────────────────────────────────────────────────
  socket.on('place-bid', ({ roomCode, listingId, amount } = {}) => {
    const code = typeof roomCode === 'string' ? roomCode.toUpperCase() : ''
    const room = rooms.get(code)
    if (!room || room.phase !== 'game' || !room.gameState) return
    const slot = room.slots.find(s => s.socketId === socket.id)
    if (!slot || slot.isAI) return

    const listing = (room.gameState.auctionListings || []).find(l => l.id === listingId)
    if (!listing || listing.status !== 'open' || listing.sellerSlot === slot.slotIndex) return

    const bid = parseInt(amount) || 0
    if (bid < listing.askingPrice) return
    if (listing.topBid != null && bid <= listing.topBid) return

    const bidder = room.gameState.teams[slot.slotIndex]
    if (!bidder || bidder.bankBalance < bid) return

    applyBid(room, code, listing, slot.slotIndex, bid)
    console.log(`Bid on ${listingId} in room ${code}: ${bid}€ by slot ${slot.slotIndex}`)
    scheduleAIBidEvaluation(room, code, listingId)
  })

  // ── cancel-listing ───────────────────────────────────────────────────────────
  socket.on('cancel-listing', ({ roomCode, listingId } = {}) => {
    const code = typeof roomCode === 'string' ? roomCode.toUpperCase() : ''
    const room = rooms.get(code)
    if (!room || room.phase !== 'game' || !room.gameState) return
    const slot = room.slots.find(s => s.socketId === socket.id)
    if (!slot || slot.isAI) return

    const listings = room.gameState.auctionListings || []
    const listing = listings.find(l => l.id === listingId)
    if (!listing || listing.status !== 'open' || listing.sellerSlot !== slot.slotIndex) return
    if (listing.topBid != null) return // bids placed — cannot cancel

    clearListingTimer(code, listingId)
    clearAIEvalTimer(code, listingId)
    const seller = room.gameState.teams[slot.slotIndex]
    if (seller) {
      seller.fleet += listing.ships
      seller.netWorth = berechneNetWorth(seller.bankBalance, seller.fleet, room.gameState.marketShipPrice)
    }
    room.gameState.auctionListings = listings.filter(l => l.id !== listingId)
    room.lastActivity = Date.now()

    io.to(code).emit('listings-updated', { listings: room.gameState.auctionListings, teams: room.gameState.teams })
    console.log(`Listing ${listingId} cancelled in room ${code}`)
  })

  // ── pass-listing ─────────────────────────────────────────────────────────────
  socket.on('pass-listing', ({ roomCode, listingId } = {}) => {
    const code = typeof roomCode === 'string' ? roomCode.toUpperCase() : ''
    const room = rooms.get(code)
    if (!room || room.phase !== 'game' || !room.gameState) return
    const slot = room.slots.find(s => s.socketId === socket.id)
    if (!slot || slot.isAI) return

    const listing = (room.gameState.auctionListings || []).find(l => l.id === listingId)
    if (!listing || listing.status !== 'open' || listing.sellerSlot === slot.slotIndex) return

    if (!listing.passedBy.includes(slot.slotIndex)) listing.passedBy.push(slot.slotIndex)

    // Resolve immediately if all non-seller connected humans have passed
    const nonSellerHumans = room.slots.filter(s =>
      !s.isAI && s.socketId && s.slotIndex !== listing.sellerSlot
    )
    if (nonSellerHumans.length > 0 && nonSellerHumans.every(s => listing.passedBy.includes(s.slotIndex))) {
      resolveListing(code, listingId)
      return
    }

    room.lastActivity = Date.now()
    io.to(code).emit('listings-updated', { listings: room.gameState.auctionListings, teams: room.gameState.teams })
  })

  // ── disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected`)
    rooms.forEach(room => {
      const slot = room.slots.find(s => s.socketId === socket.id)
      if (slot) handleLeave(socket, room.code, false) // involuntary
    })
  })
})

// ─── Leave Helper ─────────────────────────────────────────────────────────────
// Host-Übergabe und KI-Übernahme bei Verbindungsabbruch — vgl. Abschnitt 4.2
// der Arbeit. Verlässt ein Team die Partie (freiwillig oder durch
// Verbindungsabbruch), übernimmt eine KI (mit der Raum-Standardschwierigkeit)
// nahtlos den Slot, damit das Spiel für die übrigen Teams weiterläuft. War
// das ausgeschiedene Team der Host, wird die Host-Rolle automatisch an das
// nächste verbleibende menschliche Team übergeben; sind keine menschlichen
// Teams mehr im Raum, wird der Raum gelöscht.
// voluntary=true  → player clicked "Leave"
// voluntary=false → socket dropped (team gets disconnectedHuman flag for UI)

function handleLeave(socket, roomCode, voluntary = false) {
  const code = typeof roomCode === 'string' ? roomCode.toUpperCase() : ''
  const room = rooms.get(code)
  if (!room) return

  const slot = room.slots.find(s => s.socketId === socket.id)
  if (!slot) return

  const inActiveGame = room.phase === 'game' && room.gameState

  // Hand the team to AI; flag unexpected disconnects for the UI
  if (inActiveGame) {
    const team = room.gameState.teams[slot.slotIndex]
    if (team) {
      team.istKI = true
      team.aiDifficulty = room.settings.aiDifficulty
      team.disconnectedHuman = !voluntary
    }
  }

  // Always replace slot with AI placeholder
  slot.name = AI_NAMES[slot.slotIndex] || `AI Team ${slot.slotIndex + 1}`
  slot.socketId = null
  slot.isAI = true
  slot.isConnected = false

  socket.leave(code)

  // Reassign host if needed
  if (room.host === socket.id) {
    const nextHuman = room.slots.find(s => !s.isAI && s.socketId)
    if (nextHuman) {
      room.host = nextHuman.socketId
    } else {
      rooms.delete(code)
      return
    }
  }

  // If game in progress, check whether all remaining humans submitted
  if (inActiveGame && room.pendingDecisions) {
    const humanSlots = room.slots.filter(s => !s.isAI && s.socketId)
    if (humanSlots.length === 0) {
      rooms.delete(code)
      return
    }
    const allSubmitted = humanSlots.every(s => room.pendingDecisions[s.slotIndex] !== undefined)
    if (allSubmitted) {
      processRound(room)
      return
    }
  }

  room.lastActivity = Date.now()
  io.to(code).emit('room-updated', { room: sanitizeRoom(room) })
}

// ─── Cleanup Interval ─────────────────────────────────────────────────────────

setInterval(() => {
  const now = Date.now()
  const TEN_MIN    = 10 * 60 * 1000
  const FIFTEEN_MIN = 15 * 60 * 1000
  const SIXTY_MIN  = 60 * 60 * 1000

  rooms.forEach((room, code) => {
    const idle = now - room.lastActivity
    let shouldDelete = false

    if (room.phase === 'lobby' && !hasHumanPlayers(room) && idle > TEN_MIN) {
      shouldDelete = true
    } else if (room.phase === 'ended' && idle > FIFTEEN_MIN) {
      shouldDelete = true
    } else if (idle > SIXTY_MIN) {
      shouldDelete = true
    }

    if (shouldDelete) {
      rooms.delete(code)
      console.log(`Room ${code} deleted by cleanup (phase: ${room.phase}, idle: ${Math.floor(idle / 60000)}m)`)
    }
  })
}, 5 * 60 * 1000)

// ─── Static Frontend (Production) ────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')))
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  })
}

// ─── Start ────────────────────────────────────────────────────────────────────

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('Port already in use, try: $env:PORT=3003; node server.js')
    process.exit(1)
  }
})

httpServer.listen(PORT, () => {
  console.log(`Fish Banks Server running on port ${PORT}`)
  console.log('Cleanup interval started')
})
