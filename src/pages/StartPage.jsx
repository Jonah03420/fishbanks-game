import { useState } from 'react'

function StartPage({ onStart }) {
  const [playerName, setPlayerName] = useState('')
  const [maxRunden, setMaxRunden] = useState(20)
  const [showInstructions, setShowInstructions] = useState(false)

  function handleStart() {
    onStart(playerName.trim() || 'Team A', maxRunden)
  }

  return (
    <div className="min-h-screen bg-blue-900 flex items-center justify-center p-4 sm:p-8">
      <div className="bg-white/10 backdrop-blur rounded-2xl p-8 sm:p-10 max-w-lg w-full text-white">

        {/* Titel */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3 float-fish inline-block">🐟</div>
          <h1 className="text-4xl font-bold mb-2">Fish Banks Game</h1>
          <p className="text-blue-200">
            Kannst du die Fischbestände nachhaltig bewirtschaften?
          </p>
        </div>

        {/* Spielerkonfiguration */}
        <div className="space-y-4 mb-6">
          {/* Spielername */}
          <div>
            <label className="block text-sm text-blue-200 mb-1">👤 Dein Teamname</label>
            <input
              type="text"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="Team A"
              maxLength={20}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-colors"
            />
          </div>

          {/* Rundenanzahl */}
          <div>
            <label className="block text-sm text-blue-200 mb-2">🔄 Spiellänge</label>
            <div className="grid grid-cols-3 gap-2">
              {[10, 15, 20].map(r => (
                <button
                  key={r}
                  onClick={() => setMaxRunden(r)}
                  className={`py-3 rounded-xl font-bold transition-colors ${maxRunden === r ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'}`}
                >
                  {r} Runden
                  {r === 20 && <div className="text-xs font-normal">Standard</div>}
                  {r === 10 && <div className="text-xs font-normal">Schnell</div>}
                  {r === 15 && <div className="text-xs font-normal">Mittel</div>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Spielinfos */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold">{maxRunden}</div>
            <div className="text-xs text-blue-200">Runden</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold">4</div>
            <div className="text-xs text-blue-200">Teams</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold">50k</div>
            <div className="text-xs text-blue-200">Startkapital</div>
          </div>
        </div>

        {/* Spielregeln aufklappen */}
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="w-full text-blue-300 hover:text-white text-sm mb-3 transition-colors flex items-center justify-center gap-2"
        >
          {showInstructions ? '▲' : '▼'} Spielregeln anzeigen
        </button>

        {showInstructions && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6 text-sm space-y-3">
            <div>
              <div className="font-bold text-blue-200 mb-1">🎯 Ziel</div>
              <p className="text-blue-300">Verdiene so viel Geld wie möglich durch Fischfang – ohne den gemeinsamen Fischbestand zu zerstören.</p>
            </div>
            <div>
              <div className="font-bold text-blue-200 mb-1">🎮 Pro Runde hast du 3 Entscheidungen:</div>
              <ul className="text-blue-300 space-y-1">
                <li>🚢 <strong className="text-white">Boot kaufen</strong> – kostet 5.000€, erhöht deine Fangkapazität</li>
                <li>💸 <strong className="text-white">Boot verkaufen</strong> – bringt 3.000€, reduziert Kapazität</li>
                <li>🐟 <strong className="text-white">Boote aussenden</strong> – wähle wie viele du zum Fischen schickst</li>
              </ul>
            </div>
            <div>
              <div className="font-bold text-blue-200 mb-1">⚠️ Achtung</div>
              <p className="text-blue-300">Der Fischbestand wächst sich nach – aber nur wenn nicht zu viel gefischt wird. Fällt er auf 0%, ist das Spiel sofort vorbei.</p>
            </div>
            <div>
              <div className="font-bold text-blue-200 mb-1">🤖 Gegner</div>
              <p className="text-blue-300">Du spielst gegen 3 KI-Teams mit verschiedenen Strategien: <strong className="text-white">Gierig</strong>, <strong className="text-white">Kooperativ</strong> und <strong className="text-white">Rational</strong>.</p>
            </div>
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={handleStart}
          className="w-full bg-green-500 hover:bg-green-400 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors"
        >
          🎮 Spiel starten
        </button>

      </div>
    </div>
  )
}

export default StartPage
