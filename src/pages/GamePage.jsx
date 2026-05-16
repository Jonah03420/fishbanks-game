import { useState } from 'react'
import { GAME_CONFIG, berechneFischbestand, berechneFang, berechneGewinn } from '../game/fishLogic'

function GamePage({ gameState, setGameState }) {
  const spielerTeam = gameState.teams[0]
  const [ausgesandt, setAusgesandt] = useState(1)

  function handleRunde() {
    // KI Entscheidungen (gierig - senden alle Boote)
    const neueTeams = gameState.teams.map((team, index) => ({
      ...team,
      ausgesandteBoote: index === 0 ? ausgesandt : team.boote
    }))

    // Gesamte Boote berechnen
    const gesamteBoote = neueTeams.reduce((sum, t) => sum + t.ausgesandteBoote, 0)

    // Neuen Fischbestand berechnen
    const neuerFischbestand = berechneFischbestand(gameState.fischbestand, gesamteBoote)

    // Fang & Gewinn pro Team
    const teamsNachRunde = neueTeams.map(team => {
      const fang = berechneFang(team.ausgesandteBoote, gameState.fischbestand, gesamteBoote)
      const gewinn = berechneGewinn(fang, team.ausgesandteBoote)
      return {
        ...team,
        letzterFang: fang,
        guthaben: team.guthaben + gewinn,
      }
    })

    // Verlauf speichern
    const neuerVerlauf = [...gameState.verlauf, {
      runde: gameState.runde,
      fischbestand: gameState.fischbestand,
      gesamteBoote,
    }]

    setGameState({
      ...gameState,
      runde: gameState.runde + 1,
      fischbestand: neuerFischbestand,
      teams: teamsNachRunde,
      verlauf: neuerVerlauf,
      phase: gameState.runde >= GAME_CONFIG.maxRunden ? 'ende' : 'entscheidung'
    })

    setAusgesandt(1)
  }

  return (
    <div className="min-h-screen bg-blue-900 p-6">

      {/* Header */}
      <div className="flex justify-between items-center mb-6 text-white">
        <h1 className="text-2xl font-bold">🐟 Fish Banks Game</h1>
        <div className="text-right">
          <div className="text-sm text-blue-200">Runde</div>
          <div className="text-2xl font-bold">{gameState.runde} / {GAME_CONFIG.maxRunden}</div>
        </div>
      </div>

      {/* Fischbestand */}
      <div className="bg-white/10 rounded-2xl p-6 mb-6 text-white">
        <div className="flex justify-between mb-2">
          <span className="font-bold">🌊 Fischbestand</span>
          <span className="font-bold">{gameState.fischbestand}%</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-4">
          <div
            className="h-4 rounded-full transition-all duration-500"
            style={{
              width: `${gameState.fischbestand}%`,
              backgroundColor: gameState.fischbestand > 60 ? '#22c55e' : gameState.fischbestand > 30 ? '#f59e0b' : '#ef4444'
            }}
          />
        </div>
        <div className="text-sm text-blue-200 mt-2">
          {gameState.fischbestand > 60 ? '✅ Gesund' : gameState.fischbestand > 30 ? '⚠️ Gefährdet' : '🚨 Kritisch!'}
        </div>
      </div>

      {/* Teams Übersicht */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {gameState.teams.map((team, index) => (
          <div key={team.name} className={`rounded-xl p-4 text-white ${index === 0 ? 'bg-green-600' : 'bg-white/10'}`}>
            <div className="flex justify-between">
              <span className="font-bold">{team.farbe} {team.name}</span>
              <span className="text-xs">{index === 0 ? '👤 Du' : '🤖 KI'}</span>
            </div>
            <div className="text-sm mt-1">💰 {team.guthaben.toLocaleString()}€</div>
            <div className="text-sm">🚢 {team.boote} Boote</div>
            {team.letzterFang > 0 && (
              <div className="text-sm">🐟 Letzter Fang: {team.letzterFang}</div>
            )}
          </div>
        ))}
      </div>

      {/* Spieler Entscheidung */}
      <div className="bg-white/10 rounded-2xl p-6 text-white">
        <h2 className="font-bold text-lg mb-4">🎮 Deine Entscheidung – {spielerTeam.name}</h2>
        <p className="text-blue-200 mb-4">Wie viele Boote sendest du aus? (max. {spielerTeam.boote})</p>

        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setAusgesandt(Math.max(0, ausgesandt - 1))}
            className="bg-white/20 hover:bg-white/30 w-10 h-10 rounded-full text-xl font-bold"
          >−</button>
          <div className="text-4xl font-bold w-16 text-center">{ausgesandt}</div>
          <button
            onClick={() => setAusgesandt(Math.min(spielerTeam.boote, ausgesandt + 1))}
            className="bg-white/20 hover:bg-white/30 w-10 h-10 rounded-full text-xl font-bold"
          >+</button>
          <div className="text-blue-200">🚢 von {spielerTeam.boote} Booten</div>
        </div>

        <button
          onClick={handleRunde}
          className="w-full bg-green-500 hover:bg-green-400 font-bold py-4 rounded-xl text-xl transition-colors"
        >
          ✅ Runde bestätigen
        </button>
      </div>

    </div>
  )
}

export default GamePage