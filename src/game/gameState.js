import { GAME_CONFIG } from './fishLogic'

const TEAM_COLORS = ['🔴', '🟡', '🟢', '🔵']
const TEAM_NAMES = ['Team A', 'Team B', 'Team C', 'Team D']
const SLOT_PERSONALITIES = [null, 'gierig', 'kooperativ', 'rational']

export function erstelleStartzustandAusLobby(room, playerIndex) {
  const startGuthaben = room.startGuthaben || GAME_CONFIG.startGuthaben
  const startBoote = room.startBoote || GAME_CONFIG.initialBoote

  const teams = [0, 1, 2, 3].map(slot => {
    const player = room.players[slot]
    if (player) {
      const isMe = slot === playerIndex
      return erstelleTeam(player.name, TEAM_COLORS[slot], !isMe, isMe ? null : 'kooperativ', startGuthaben, startBoote, true)
    }
    return erstelleTeam(TEAM_NAMES[slot], TEAM_COLORS[slot], true, SLOT_PERSONALITIES[slot] || 'kooperativ', startGuthaben, startBoote, false)
  })

  const [myTeam] = teams.splice(playerIndex, 1)
  teams.unshift(myTeam)

  return {
    runde: 1,
    fischbestand: GAME_CONFIG.startFischbestand,
    phase: 'entscheidung',
    maxRunden: room.maxRunden,
    schwierigkeitsgrad: room.schwierigkeitsgrad || 'leicht',
    marketShipPrice: GAME_CONFIG.auctionPreis,
    auctionHistory: [],
    teams,
    verlauf: [],
  }
}

function erstelleTeam(name, farbe, istKI, persoenlichkeit, startGuthaben = GAME_CONFIG.startGuthaben, startBoote = GAME_CONFIG.initialBoote, isRealHuman = false) {
  return {
    name,
    farbe,
    boote: startBoote,
    guthaben: startGuthaben,
    netWorth: startGuthaben + startBoote * GAME_CONFIG.auctionPreis,
    ausgesandteBoote: 0,
    letzterFang: 0,
    letzteZinsen: 0,
    istKI,
    persoenlichkeit,
    isRealHuman,
  }
}
