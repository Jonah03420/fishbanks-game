import { GAME_CONFIG } from './fishLogic'

const TEAM_COLORS = ['🔴', '🟡', '🟢', '🔵']
const AI_PERSONALITIES = ['gierig', 'kooperativ', 'rational']
const AI_NAMES = ['Team B', 'Team C', 'Team D', 'Team E']

export function erstelleStartzustand(playerName = 'Team A', maxRunden = GAME_CONFIG.maxRunden, schwierigkeitsgrad = 'mittel') {
  return {
    runde: 1,
    fischbestand: GAME_CONFIG.startFischbestand,
    phase: 'entscheidung', // 'entscheidung' | 'ergebnis' | 'ende'
    maxRunden,
    schwierigkeitsgrad,
    teams: [
      erstelleTeam(playerName, '🔴', false, null),
      erstelleTeam('Team B', '🟡', true, 'gierig'),
      erstelleTeam('Team C', '🟢', true, 'kooperativ'),
      erstelleTeam('Team D', '🔵', true, 'rational'),
    ],
    verlauf: [],
  }
}

// Builds game state from a finished lobby room.
// "My" team (playerIndex) goes to index 0 so GamePage's teams[0] == human player.
// Other joined humans simulate with 'kooperativ' AI since there's no real-time sync yet.
export function erstelleStartzustandAusLobby(room, playerIndex) {
  const humanTeams = room.players.map((player, i) => {
    const isMe = i === playerIndex
    return erstelleTeam(player.name, TEAM_COLORS[i], !isMe, isMe ? null : 'kooperativ')
  })

  const aiCount = 4 - humanTeams.length
  const aiTeams = Array.from({ length: aiCount }, (_, i) => {
    const slot = humanTeams.length + i
    return erstelleTeam(
      AI_NAMES[slot - 1] || `Team ${slot + 1}`,
      TEAM_COLORS[slot],
      true,
      AI_PERSONALITIES[i % AI_PERSONALITIES.length]
    )
  })

  const all = [...humanTeams, ...aiTeams]
  // Bring my team to front so GamePage's teams[0] is always the local player
  const [myTeam] = all.splice(playerIndex, 1)
  all.unshift(myTeam)

  return {
    runde: 1,
    fischbestand: GAME_CONFIG.startFischbestand,
    phase: 'entscheidung',
    maxRunden: room.maxRunden,
    schwierigkeitsgrad: 'mittel',
    teams: all,
    verlauf: [],
  }
}

function erstelleTeam(name, farbe, istKI, persoenlichkeit) {
  return {
    name,
    farbe,
    boote: 5,
    guthaben: GAME_CONFIG.startGuthaben,
    ausgesandteBoote: 0,
    letzterFang: 0,
    istKI,
    persoenlichkeit, // null | 'gierig' | 'kooperativ' | 'rational'
  }
}