import { GAME_CONFIG } from './fishLogic'

export function erstelleStartzustand() {
  return {
    runde: 1,
    fischbestand: GAME_CONFIG.startFischbestand,
    phase: 'entscheidung', // 'entscheidung' | 'ergebnis' | 'ende'
    teams: [
      erstelleTeam('Team A', '🔴'),
      erstelleTeam('Team B', '🟡'),
      erstelleTeam('Team C', '🟢'),
      erstelleTeam('Team D', '🔵'),
    ],
    verlauf: [], // Speichert alle Runden für Debriefing
  }
}

function erstelleTeam(name, farbe) {
  return {
    name,
    farbe,
    boote: 5,
    guthaben: GAME_CONFIG.startGuthaben,
    ausgesandteBoote: 0,
    letzterFang: 0,
    istKI: true, // Standardmäßig KI - erstes Team ist Spieler
  }
}