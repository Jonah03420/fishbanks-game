function EndPage({ gameState, onRestart }) {
  const winner = [...gameState.teams].sort((a, b) => b.guthaben - a.guthaben)[0]

  return (
    <div className="min-h-screen bg-blue-900 flex items-center justify-center p-6">
      <div className="bg-white/10 rounded-2xl p-8 max-w-2xl w-full text-white">

        {/* Titel */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">
            {gameState.fischbestand === 0 ? '💀' : '🏆'}
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {gameState.fischbestand === 0 ? 'Fischbestand kollabiert!' : 'Spiel beendet!'}
          </h1>
          <p className="text-blue-200">
            {gameState.fischbestand === 0
              ? 'Die Überfischung hat den Bestand vernichtet – Tragedy of the Commons.'
              : `Verbleibender Fischbestand: ${gameState.fischbestand}%`}
          </p>
        </div>

        {/* Gewinner */}
        <div className="bg-yellow-500/20 rounded-xl p-4 mb-6 text-center">
          <div className="text-sm text-yellow-200 mb-1">🏆 Gewinner</div>
          <div className="text-2xl font-bold">{winner.farbe} {winner.name}</div>
          <div className="text-yellow-200">💰 {winner.guthaben.toLocaleString()}€</div>
        </div>

        {/* Rangliste */}
        <div className="mb-6">
          <h2 className="font-bold mb-3">📊 Rangliste</h2>
          {[...gameState.teams]
            .sort((a, b) => b.guthaben - a.guthaben)
            .map((team, index) => (
              <div key={team.name} className="flex justify-between items-center bg-white/10 rounded-xl p-3 mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '4️⃣'}</span>
                  <span>{team.farbe} {team.name}</span>
                </div>
                <span className="font-bold">💰 {team.guthaben.toLocaleString()}€</span>
              </div>
            ))}
        </div>

        {/* Neustart */}
        <button
          onClick={onRestart}
          className="w-full bg-green-500 hover:bg-green-400 font-bold py-4 rounded-xl text-xl transition-colors"
        >
          🔄 Nochmal spielen
        </button>

      </div>
    </div>
  )
}

export default EndPage