import { GAME_CONFIG } from './fishLogic'

const TEAM_COLORS = ['🔴', '🟡', '🟢', '🔵']
const TEAM_NAMES = ['Team A', 'Team B', 'Team C', 'Team D']
// Slot 0 = host (no AI), Slot 1 = Greedy, Slot 2 = Cooperative, Slot 3 = Rational
const SLOT_PERSONALITIES = [null, 'gierig', 'kooperativ', 'rational']

export function erstelleStartzustandAusLobby(room, playerIndex) {
  const startGuthaben = room.startGuthaben || GAME_CONFIG.startGuthaben
  const startBoote = room.startBoote || GAME_CONFIG.initialBoote

  // Teams stay in fixed slot order 0-3. Human slots: istKI=false. AI slots: istKI=true.
  const teams = [0, 1, 2, 3].map(slot => {
    const player = room.players[slot]
    if (player) {
      return erstelleTeam(slot + 1, player.name, TEAM_COLORS[slot], false, null, startGuthaben, startBoote, true)
    }
    return erstelleTeam(
      slot + 1, TEAM_NAMES[slot], TEAM_COLORS[slot], true,
      SLOT_PERSONALITIES[slot] || 'kooperativ',
      startGuthaben, startBoote, false
    )
  })

  return {
    runde: 1,
    fischbestand: GAME_CONFIG.startFischbestand,
    phase: 'entscheidung',
    maxRunden: room.maxRunden,
    schwierigkeitsgrad: room.schwierigkeitsgrad || 'leicht',
    marketShipPrice: GAME_CONFIG.auctionPreis,
    auctionHistory: [],
    playerIndex,
    teams,
    verlauf: [],
  }
}

function erstelleTeam(id, name, farbe, istKI, persoenlichkeit, startGuthaben, startBoote, isRealHuman) {
  return {
    id,
    name, farbe,
    fleet: startBoote,
    bankBalance: startGuthaben,
    netWorth: startGuthaben + startBoote * GAME_CONFIG.auctionPreis,
    ausgesandteBoote: 0,
    harborShips: 0,
    coastalShips: 0,
    deepSeaShips: 0,
    letzterFang: 0,
    letzteZinsen: 0,
    shipsInDelivery: 0,
    istKI,
    persoenlichkeit,
    isRealHuman,
  }
}
