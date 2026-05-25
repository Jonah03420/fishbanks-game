import { GAME_CONFIG } from './fishLogic'

const TEAM_COLORS = ['🔴', '🟡', '🟢', '🔵']
const TEAM_NAMES = ['Team A', 'Team B', 'Team C', 'Team D']
const DEFAULT_AI_DIFFICULTIES = [null, 'easy', 'easy', 'easy']

export function erstelleStartzustandAusLobby(room, playerIndex) {
  const numTeams = room.numTeams || 4
  const startGuthaben = room.startingCapital || room.startGuthaben || GAME_CONFIG.startGuthaben
  const startBoote = room.startBoote || GAME_CONFIG.initialBoote
  const aiDifficulties = room.aiDifficulties || DEFAULT_AI_DIFFICULTIES

  // Build params object from room (admin-configured values) with GAME_CONFIG fallbacks
  const params = {
    fishPrice: room.fishPrice ?? GAME_CONFIG.fischPreis,
    newShipPrice: room.newShipPrice ?? GAME_CONFIG.bootKosten,
    interestRate: room.interestRate ?? GAME_CONFIG.zinsRate,
    harborCost: room.harborCost ?? GAME_CONFIG.harborCost,
    coastalCost: room.coastalCost ?? GAME_CONFIG.coastalCost,
    deepSeaCost: room.deepSeaCost ?? GAME_CONFIG.deepSeaCost,
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
      aiDifficulties[slot] || 'easy',
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
    pendingAuctionOffers: [],
    auctionListings: [],
    playerIndex,
    teams,
    verlauf: [],
    params,
  }
}

function erstelleTeam(id, name, farbe, istKI, aiDifficulty, startGuthaben, startBoote, isRealHuman) {
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
    auctionPurchases: 0,
    istKI,
    aiDifficulty,
    isRealHuman,
  }
}
