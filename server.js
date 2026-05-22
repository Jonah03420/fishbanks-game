import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

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
    startingBalance: overrides.startingBalance ?? 5000,
    startingFleet: overrides.startingFleet ?? 3,
    fishPrice: overrides.fishPrice ?? 20,
    newShipPrice: overrides.newShipPrice ?? 300,
    auctionPrice: overrides.auctionPrice ?? 500,
    interestRate: overrides.interestRate ?? 0.02,
    maxFishPopulation: overrides.maxFishPopulation ?? 6000,
    startingFish: overrides.startingFish ?? 4000,
    reproductionRate: overrides.reproductionRate ?? 0.05,
    operatingCosts: {
      harbor: 50,
      coastal: 150,
      deepSea: 250,
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

// Remove socketId before sending to clients (security)
function sanitizeRoom(room) {
  return {
    ...room,
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
      gameState: null
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

    // Validate individual fields
    if ([10, 15, 20].includes(incoming.maxRounds)) prev.maxRounds = incoming.maxRounds
    if (typeof incoming.numTeams === 'number' && incoming.numTeams >= 2 && incoming.numTeams <= 6) {
      const oldCount = prev.numTeams
      const newCount = incoming.numTeams
      prev.numTeams = newCount

      if (newCount > oldCount) {
        // Add AI slots
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
        // Remove slots from the end — kick humans back to the lobby if needed
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
        // Re-index slotIndex
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

  // ── disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected`)
    // Find and leave all rooms this socket is part of
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

  // Replace the human with an AI
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

  room.lastActivity = Date.now()
  io.to(code).emit('room-updated', { room: sanitizeRoom(room) })
}

// ─── Cleanup Interval ─────────────────────────────────────────────────────────

setInterval(() => {
  const now = Date.now()
  const TEN_MIN = 10 * 60 * 1000
  const FIFTEEN_MIN = 15 * 60 * 1000
  const SIXTY_MIN = 60 * 60 * 1000

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
