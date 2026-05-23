import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import {
  GAME_CONFIG,
  berechneFischbestand,
  erzeugeMarktereignis,
  berechneNetWorth,
  kiDecisionEasy,
  kiDecisionHard,
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
      socketId: undefined
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
    teams,
    verlauf: [],
    params,
  }
}

// ─── Round Processing ─────────────────────────────────────────────────────────
//
// Follows exact MIT order (mit_reference.md §3 and §7):
//   Step 1  Deliver ships from previous round's orders
//   Step 2  AI decisions (after delivery, uses current fish stock)
//   Step 3  Auction buy / sell → track minBalance
//   Step 4  Operating costs   → track minBalance
//   Step 5  Fish catch + revenue → track minBalance
//   Step 6  Interest on minBalance (MIT §6: same formula, sign auto)
//   Step 7  New ship orders (pay now, deliver next round)
//   Step 8  Update fish stock (logistic growth)
//   Step 9  Market price (constant in Phase 3)
//   Step 10 Recalculate net worth
//   Step 11 Save round snapshot to verlauf
//   Step 12 Check game end → emit 'game-ended' or 'round-complete'

function processRound(room) {
  const gs = room.gameState
  const { params } = gs
  if (!room.pendingDecisions) room.pendingDecisions = {}

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

  // Steps 3–7: Per-team processing
  const aiShipPurchases = []

  for (let i = 0; i < gs.teams.length; i++) {
    const team = gs.teams[i]
    const dec  = room.pendingDecisions[i]
    if (!dec) continue

    // Step 3: Auction buy / sell — applied before minBalance tracking (matches client sim)
    const toBuy  = Math.max(0, dec.shipsToBuy  ?? 0)
    const toSell = Math.min(Math.max(0, dec.shipsToSell ?? 0), team.fleet)
    team.fleet  += toBuy - toSell
    team.auctionPurchases = toBuy
    team.bankBalance -= toBuy  * gs.marketShipPrice
    team.bankBalance += toSell * gs.marketShipPrice

    if (team.istKI && toBuy > 0) {
      aiShipPurchases.push({ name: team.name, farbe: team.farbe, count: toBuy, price: gs.marketShipPrice })
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

    // Step 6: Interest on minimum balance reached this round (MIT §6)
    const zinsen    = Math.round(minBalance * params.interestRate)
    balance        += zinsen
    team.letzteZinsen = zinsen

    // Step 7: New ship orders — payment immediate, delivery next round
    const maxOrder     = Math.ceil(team.fleet / 2)
    const actualOrders = Math.min(Math.max(0, dec.newShipOrders ?? 0), maxOrder)
    const orderCost    = actualOrders * params.newShipPrice
    balance           -= orderCost
    team.shipsInDelivery = actualOrders
    team.bankBalance     = balance

    // Attach roundSummary for the round result modal
    team.roundSummary = {
      startBalance,
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

  // Step 9: Market price unchanged in Phase 4

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
  }
  for (const team of gs.teams) {
    verlaufEintrag[team.name]           = Math.round(team.netWorth)
    verlaufEintrag[`${team.name}_rs`]   = team.roundSummary
  }
  gs.verlauf.push(verlaufEintrag)

  // Attach top-level round data for the round result modal
  gs.letzterWetterfaktor = wetterfaktor
  gs.letzterGesamtFang   = totalCatch
  gs.letzteAuktionEvents = []
  gs.roundDeliveries     = roundDeliveries
  gs.aiShipPurchases     = aiShipPurchases

  // Step 12: Game end — max rounds reached or fish stock collapsed
  const isOver = gs.runde >= gs.maxRunden || gs.fischbestand <= 0

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
    handleLeave(socket, roomCode)
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

    io.to(code).emit('game-started', { gameState: room.gameState })
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
      processRound(room)
    }
  })

  // ── disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected`)
    rooms.forEach(room => {
      const slot = room.slots.find(s => s.socketId === socket.id)
      if (slot) handleLeave(socket, room.code)
    })
  })
})

// ─── Leave Helper ─────────────────────────────────────────────────────────────

function handleLeave(socket, roomCode) {
  const code = typeof roomCode === 'string' ? roomCode.toUpperCase() : ''
  const room = rooms.get(code)
  if (!room) return

  const slot = room.slots.find(s => s.socketId === socket.id)
  if (!slot) return

  // If game is running, convert team to AI so the round can still complete
  if (room.phase === 'game' && room.gameState) {
    const team = room.gameState.teams[slot.slotIndex]
    if (team) {
      team.istKI = true
      team.aiDifficulty = room.settings.aiDifficulty
      team.isRealHuman = false
    }
  }

  // Replace slot with AI placeholder
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
      // No humans left — delete room
      rooms.delete(code)
      return
    }
  }

  // If game in progress, check whether the disconnecting player was the last
  // one to submit — if so, all remaining humans are done, process the round
  if (room.phase === 'game' && room.gameState && room.pendingDecisions) {
    const humanSlots = room.slots.filter(s => !s.isAI && s.socketId)
    const allSubmitted = humanSlots.length > 0 &&
      humanSlots.every(s => room.pendingDecisions[s.slotIndex] !== undefined)
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
