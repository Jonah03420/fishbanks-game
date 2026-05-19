// Acts as a fake backend: stores rooms in localStorage so multiple tabs on the same
// device can share state. Real networking will replace this module later.

const STORAGE_KEY = 'fishbanks_lobby_v1'
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

export function generateRoomCode() {
  return Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
}

function readRooms() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  catch { return {} }
}

function writeRooms(rooms) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms))
}

function makeId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
}

export function createRoom({ code, creatorName, maxRunden, maxHumanPlayers, schwierigkeitsgrad, startGuthaben, startBoote }) {
  const rooms = readRooms()
  const myId = makeId()
  rooms[code] = {
    code,
    maxRunden,
    maxHumanPlayers,
    schwierigkeitsgrad,
    startGuthaben,
    startBoote,
    players: [{ id: myId, name: creatorName, isCreator: true }],
    status: 'waiting',
  }
  writeRooms(rooms)
  return { room: rooms[code], myId }
}

export function joinRoom(code, playerName) {
  const rooms = readRooms()
  const room = rooms[code]
  if (!room) return { error: 'Raum nicht gefunden' }
  if (room.status !== 'waiting') return { error: 'Spiel bereits gestartet' }
  if (room.players.length >= room.maxHumanPlayers) return { error: 'Raum ist voll' }
  const myId = makeId()
  room.players.push({ id: myId, name: playerName, isCreator: false })
  writeRooms(rooms)
  return { room, myId }
}

export function getRoom(code) {
  return readRooms()[code] || null
}

export function updateSettings(code, settings) {
  const rooms = readRooms()
  if (!rooms[code]) return null
  rooms[code] = { ...rooms[code], ...settings }
  writeRooms(rooms)
  return rooms[code]
}

export function startGame(code) {
  const rooms = readRooms()
  if (!rooms[code]) return null
  rooms[code] = { ...rooms[code], status: 'started' }
  writeRooms(rooms)
  return rooms[code]
}

export function leaveRoom(code, myId) {
  const rooms = readRooms()
  const room = rooms[code]
  if (!room) return
  room.players = room.players.filter(p => p.id !== myId)
  if (room.players.length === 0) {
    delete rooms[code]
  } else if (!room.players.some(p => p.isCreator)) {
    room.players[0].isCreator = true
  }
  writeRooms(rooms)
}
