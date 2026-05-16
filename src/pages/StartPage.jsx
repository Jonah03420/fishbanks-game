import { GAME_CONFIG } from '../game/fishLogic'

function StartPage({ onStart }) {
  return (
    <div className="min-h-screen bg-blue-900 flex items-center justify-center p-8">
      <div className="bg-white/10 backdrop-blur rounded-2xl p-10 max-w-lg w-full text-white text-center">
        
        {/* Titel */}
        <div className="text-6xl mb-4">🐟</div>
        <h1 className="text-4xl font-bold mb-2">Fish Banks Game</h1>
        <p className="text-blue-200 mb-8">
          Kannst du die Fischbestände nachhaltig bewirtschaften?
        </p>

        {/* Spielinfos */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">{GAME_CONFIG.maxRunden}</div>
            <div className="text-sm text-blue-200">Runden</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">4</div>
            <div className="text-sm text-blue-200">Teams</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">50k</div>
            <div className="text-sm text-blue-200">Startkapital</div>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={onStart}
          className="w-full bg-green-500 hover:bg-green-400 text-white font-bold py-4 px-8 rounded-xl text-xl transition-colors"
        >
          🎮 Spiel starten
        </button>

      </div>
    </div>
  )
}

export default StartPage