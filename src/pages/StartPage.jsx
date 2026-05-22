import { GAME_CONFIG } from '../game/fishLogic'

function StartPage({ onCreateGame, onJoinGame, onOpenAdmin }) {
  return (
    <div className="w-full h-full bg-blue-900 text-white flex overflow-hidden">

      {/* Left panel — branding + feature highlights */}
      <div className="flex-1 flex flex-col justify-center px-16 py-12 bg-gradient-to-br from-blue-800 to-blue-950">
        <div className="text-9xl mb-6 float-fish inline-block">🐟</div>
        <h1 className="text-6xl font-bold mb-4 leading-tight">Fish Banks<br />Game</h1>
        <p className="text-blue-200 text-xl mb-10 max-w-md">
          Can you manage fish stocks sustainably – while other teams fish without restraint?
        </p>

        <div className="grid grid-cols-2 gap-4 max-w-lg">
          <div className="bg-white/10 rounded-xl p-4">
            <div className="font-bold text-sm mb-1">Shared Resource</div>
            <div className="text-blue-300 text-xs">All teams share the same fish stock – overfishing destroys it for everyone.</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="font-bold text-sm mb-1">AI fills empty slots</div>
            <div className="text-blue-300 text-xs">Easy or Hard AI teams automatically fill empty spots.</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="font-bold text-sm mb-1">Live Analysis</div>
            <div className="text-blue-300 text-xs">Track fish stock and balance of all teams across the entire game.</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="font-bold text-sm mb-1">Learning Game</div>
            <div className="text-blue-300 text-xs">Based on Garrett Hardin's "Tragedy of the Commons" and Elinor Ostrom's research.</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 max-w-lg mt-2 text-xs text-blue-300">
          <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
            <div className="font-bold text-white">{GAME_CONFIG.initialBoote} ships</div>
            <div>Starting fleet (config.)</div>
          </div>
          <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
            <div className="font-bold text-white">{GAME_CONFIG.startGuthaben.toLocaleString()}€</div>
            <div>Starting balance (config.)</div>
          </div>
          <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
            <div className="font-bold text-white">{GAME_CONFIG.startFischbestand.toLocaleString()} / {GAME_CONFIG.maxFischbestand.toLocaleString()}</div>
            <div>Fish stock (Start / Max)</div>
          </div>
          <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
            <div className="font-bold text-white">{GAME_CONFIG.fischPreis}€ / fish</div>
            <div>Fish price</div>
          </div>
          <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
            <div className="font-bold text-white">{GAME_CONFIG.bootKosten}€ new</div>
            <div>Buy ship (Shipyard)</div>
          </div>
          <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
            <div className="font-bold text-white">{GAME_CONFIG.auctionPreis}€ auction</div>
            <div>Buy / sell ships</div>
          </div>
        </div>
      </div>

      {/* Right panel — action */}
      <div className="w-96 flex flex-col justify-center px-10 py-12 bg-blue-950/60 border-l border-white/10">
        <h2 className="text-2xl font-bold mb-2">Start Game</h2>
        <p className="text-blue-300 text-sm mb-10">Create a room as host or join an ongoing game.</p>

        <div className="flex flex-col gap-4">
          <button
            onClick={onCreateGame}
            className="w-full bg-green-500 hover:bg-green-400 text-white font-bold py-5 px-6 rounded-xl text-lg transition-colors text-left"
          >
            <div className="font-bold">Create Game</div>
            <div className="text-green-100 text-sm font-normal">Open a room as host</div>
          </button>

          <button
            onClick={onJoinGame}
            className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-5 px-6 rounded-xl text-lg transition-colors text-left"
          >
            <div className="font-bold">Join Game</div>
            <div className="text-blue-100 text-sm font-normal">Enter with 4-letter room code</div>
          </button>
        </div>

        <div className="mt-12 bg-white/5 rounded-xl p-5 text-xs text-blue-400">
          <div className="font-bold text-blue-300 mb-2">How it works</div>
          <ol className="space-y-1.5 list-decimal list-inside">
            <li>Host creates room &amp; shares the code with participants</li>
            <li>Players join – empty slots are filled by AI</li>
            <li>Each round: decide how many ships to deploy</li>
            <li>Manage sustainably – or risk the collapse!</li>
          </ol>
        </div>

        <button
          onClick={onOpenAdmin}
          className="mt-4 text-blue-600 hover:text-blue-400 text-xs flex items-center gap-1 transition-colors"
        >
          ⚙ Instructor Settings
        </button>
      </div>
    </div>
  )
}

export default StartPage
