import { GAME_CONFIG } from './fishLogic'

const TEAM_COLORS = ['🔴', '🟡', '🟢', '🔵']
const TEAM_NAMES = ['Team A', 'Team B', 'Team C', 'Team D']
const DEFAULT_PERSONALITIES = [null, 'gierig', 'kooperativ', 'rational']

export function erstelleStartzustandAusLobby(room, playerIndex) {
  const numTeams = room.numTeams || 4
  const startGuthaben = room.startingCapital || room.startGuthaben || GAME_CONFIG.startGuthaben
  const startBoote = room.startBoote || GAME_CONFIG.initialBoote
  const aiPersonalities = room.aiPersonalities || DEFAULT_PERSONALITIES

  // Build params object from room (admin-configured values) with GAME_CONFIG fallbacks
  const params = {
    fishPrice: room.fishPrice ?? GAME_CONFIG.fischPreis,
    newShipPrice: room.newShipPrice ?? GAME_CONFIG.bootKosten,
    interestRate: room.interestRate ?? GAME_CONFIG.zinsRate,
    operatingCostPerShip: room.operatingCostPerShip ?? GAME_CONFIG.betriebskosten,
    maxFishPopulation: room.maxFishPopulation ?? GAME_CONFIG.maxFischbestand,
    startingFishStock: room.startingFishStock ?? GAME_CONFIG.startFischbestand,
    fishReproductionRate: room.fishReproductionRate ?? GAME_CONFIG.wachstumsRate,
    showFishStock: room.showFishStock ?? true,
    showOtherCatches: room.showOtherCatches ?? true,
  }

  // Teams stay in fixed slot order 0..numTeams-1. Human slots: istKI=false. AI slots: istKI=true.
  const teams = Array.from({ length: numTeams }, (_, slot) => {
    const player = room.players[slot]
    if (player) {
      return erstelleTeam(slot + 1, player.name, TEAM_COLORS[slot], false, null, startGuthaben, startBoote, true)
    }
    return erstelleTeam(
      slot + 1, TEAM_NAMES[slot], TEAM_COLORS[slot], true,
      aiPersonalities[slot] || 'kooperativ',
      startGuthaben, startBoote, false
    )
  })

  return {
    runde: 1,
    fischbestand: params.startingFishStock,
    phase: 'entscheidung',
    maxRunden: room.maxRunden,
    schwierigkeitsgrad: room.schwierigkeitsgrad || 'leicht',
    marketShipPrice: GAME_CONFIG.auctionPreis,
    auctionHistory: [],
    playerIndex,
    teams,
    verlauf: [],
    params,
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
