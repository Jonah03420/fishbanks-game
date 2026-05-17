import { GAME_CONFIG } from './fishLogic'

export function erstelleStartzustand(playerName = 'Team A', maxRunden = GAME_CONFIG.maxRunden) {
  return {
    runde: 1,
    fischbestand: GAME_CONFIG.startFischbestand,
    phase: 'entscheidung', // 'entscheidung' | 'ergebnis' | 'ende'
    maxRunden,
    teams: [
      erstelleTeam(playerName, '🔴', false, null),
      erstelleTeam('Team B', '🟡', true, 'gierig'),
      erstelleTeam('Team C', '🟢', true, 'kooperativ'),
      erstelleTeam('Team D', '🔵', true, 'rational'),
    ],
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