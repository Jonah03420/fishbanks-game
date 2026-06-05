import { GAME_CONFIG } from '../game/fishLogic'

function FishLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Tail */}
      <path d="M28 50 L4 22 Q13 50 4 78 Z" fill="#0369a1"/>
      <path d="M28 50 L4 22 Q17 50 4 78 Z" fill="#38bdf8" opacity="0.45"/>
      {/* Body */}
      <ellipse cx="88" cy="50" rx="56" ry="34" fill="#0ea5e9"/>
      {/* Top highlight */}
      <ellipse cx="80" cy="38" rx="38" ry="16" fill="#7dd3fc" opacity="0.35"/>
      {/* Top fin */}
      <path d="M56 16 C64 2 88 0 98 16" fill="#0284c7"/>
      {/* Bottom fin */}
      <path d="M68 84 C74 98 90 100 96 84" fill="#0284c7" opacity="0.8"/>
      {/* Gill */}
      <path d="M92 26 Q86 50 92 74" stroke="#075985" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Eye */}
      <circle cx="118" cy="44" r="10" fill="white"/>
      <circle cx="119" cy="44" r="6.5" fill="#0c4a6e"/>
      <circle cx="119" cy="44" r="3" fill="#082f49"/>
      <circle cx="121" cy="41" r="2" fill="white"/>
      {/* Scale hints */}
      <path d="M68 42 Q78 36 88 42" stroke="#bae6fd" strokeWidth="1" fill="none" opacity="0.5"/>
      <path d="M58 50 Q68 44 78 50" stroke="#bae6fd" strokeWidth="1" fill="none" opacity="0.5"/>
      <path d="M78 56 Q88 50 98 56" stroke="#bae6fd" strokeWidth="1" fill="none" opacity="0.5"/>
    </svg>
  )
}

function StartPage({ connected, onCreateGame, onJoinGame, onOpenAdmin }) {
  return (
    <div className="w-full h-full bg-blue-900 text-white flex overflow-hidden">

      {/* Left panel — branding + feature highlights */}
      <div className="relative flex-1 flex flex-col justify-center px-16 py-12 bg-gradient-to-br from-blue-800 to-blue-950 overflow-hidden">

        {/* Background depth glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-400/[0.13] rounded-full blur-3xl pointer-events-none"/>
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-blue-300/[0.10] rounded-full blur-2xl pointer-events-none"/>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-sky-300/[0.06] rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"/>

        {/* Floating bubbles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute bottom-20 left-16 w-2.5 h-2.5 bg-cyan-300/45 rounded-full bubble-float" style={{animationDelay:'0s'}}/>
          <div className="absolute bottom-32 left-36 w-3.5 h-3.5 bg-blue-300/35 rounded-full bubble-float" style={{animationDelay:'1.8s'}}/>
          <div className="absolute bottom-16 left-1/2 w-2 h-2 bg-cyan-200/45 rounded-full bubble-float" style={{animationDelay:'3.2s'}}/>
          <div className="absolute bottom-40 right-32 w-4 h-4 bg-blue-400/30 rounded-full bubble-float" style={{animationDelay:'0.6s'}}/>
          <div className="absolute bottom-24 right-20 w-2.5 h-2.5 bg-cyan-300/38 rounded-full bubble-float" style={{animationDelay:'2.5s'}}/>
          <div className="absolute bottom-48 left-1/3 w-3 h-3 bg-blue-200/35 rounded-full bubble-float" style={{animationDelay:'4.1s'}}/>
          <div className="absolute bottom-60 left-24 w-1.5 h-1.5 bg-cyan-400/40 rounded-full bubble-float" style={{animationDelay:'5.3s'}}/>
          <div className="absolute bottom-36 right-1/2 w-2 h-2 bg-sky-300/32 rounded-full bubble-float" style={{animationDelay:'2.0s'}}/>
        </div>

        {/* Animated waves at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-20 overflow-hidden pointer-events-none">
          <svg viewBox="0 0 2400 80" preserveAspectRatio="none" className="w-[200%] h-full wave-shift" style={{opacity:0.24}}>
            <path d="M0,40 C200,70 400,10 600,40 C800,70 1000,10 1200,40 C1400,70 1600,10 1800,40 C2000,70 2200,10 2400,40 L2400,80 L0,80 Z" fill="#7dd3fc"/>
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-12 overflow-hidden pointer-events-none">
          <svg viewBox="0 0 2400 50" preserveAspectRatio="none" className="w-[200%] h-full wave-shift" style={{opacity:0.18, animationDirection:'reverse', animationDuration:'18s'}}>
            <path d="M0,25 C300,48 600,4 900,25 C1200,48 1500,4 1800,25 C2100,48 2400,4 2700,25 L2700,50 L0,50 Z" fill="#38bdf8"/>
          </svg>
        </div>

        {/* Fishing line + hook — straight down, hook opens LEFT toward fish */}
        <svg
          className="absolute top-0 pointer-events-none hook-bob"
          style={{left: '240px', width: '24px', height: '210px', zIndex: 6}}
          viewBox="0 0 24 210"
          fill="none"
        >
          <defs>
            <linearGradient id="lineGrad" x1="12" y1="0" x2="12" y2="170" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="white" stopOpacity="0.06"/>
              <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0.40"/>
            </linearGradient>
          </defs>
          {/* Straight vertical line from panel top */}
          <line x1="12" y1="0" x2="12" y2="170" stroke="url(#lineGrad)" strokeWidth="1.3"/>
          {/* Eye ring */}
          <circle cx="12" cy="173" r="3" stroke="rgba(185,215,255,0.50)" strokeWidth="1.2" fill="none"/>
          {/* Shank */}
          <line x1="12" y1="177" x2="12" y2="189" stroke="rgba(185,215,255,0.82)" strokeWidth="1.9" strokeLinecap="round"/>
          {/* Bend — curves LEFT */}
          <path d="M12 189 Q12 203 3 203" stroke="rgba(185,215,255,0.82)" strokeWidth="1.9" fill="none" strokeLinecap="round"/>
          {/* Point — goes back UP on the left */}
          <line x1="3" y1="203" x2="3" y2="192" stroke="rgba(185,215,255,0.82)" strokeWidth="1.9" strokeLinecap="round"/>
          {/* Barb */}
          <path d="M3 196 L8 203" stroke="rgba(185,215,255,0.62)" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>

        <FishLogo className="w-40 mb-6 float-fish" />
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

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={onOpenAdmin}
            className="text-blue-600 hover:text-blue-400 text-xs flex items-center gap-1.5 transition-colors"
          >
            <span className="w-3 h-3 text-[10px] flex items-center justify-center flex-shrink-0 leading-none">⚙</span>
            Instructor Settings
          </button>
          <div className={`flex items-center gap-1.5 text-xs ${connected ? 'text-green-500' : 'text-red-400'}`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-500 server-online' : 'bg-red-400'}`}/>
            {connected ? 'Server online' : 'Server offline'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default StartPage
