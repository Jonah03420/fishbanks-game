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
          style={{left: '240px', width: '24px', height: '162px', zIndex: 6}}
          viewBox="0 0 24 162"
          fill="none"
        >
          <defs>
            <linearGradient id="lineGrad" x1="12" y1="0" x2="12" y2="120" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="white" stopOpacity="0.06"/>
              <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0.40"/>
            </linearGradient>
          </defs>
          {/* Straight vertical line from panel top */}
          <line x1="12" y1="0" x2="12" y2="120" stroke="url(#lineGrad)" strokeWidth="1.3"/>
          {/* Eye ring */}
          <circle cx="12" cy="123" r="3" stroke="rgba(185,215,255,0.50)" strokeWidth="1.2" fill="none"/>
          {/* Shank */}
          <line x1="12" y1="127" x2="12" y2="139" stroke="rgba(185,215,255,0.82)" strokeWidth="1.9" strokeLinecap="round"/>
          {/* Bend — curves LEFT */}
          <path d="M12 139 Q12 153 3 153" stroke="rgba(185,215,255,0.82)" strokeWidth="1.9" fill="none" strokeLinecap="round"/>
          {/* Point — goes back UP on the left */}
          <line x1="3" y1="153" x2="3" y2="142" stroke="rgba(185,215,255,0.82)" strokeWidth="1.9" strokeLinecap="round"/>
          {/* Barb */}
          <path d="M3 146 L8 153" stroke="rgba(185,215,255,0.62)" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>

        <FishLogo className="w-40 mb-6 float-fish" />
        <h1 className="text-6xl font-bold mb-4 leading-tight">Fish Banks<br />Game</h1>
        <p className="text-blue-200 text-xl mb-10 max-w-md">
          A shared ocean. Competing teams. Will anyone fish sustainably?
        </p>

        <div className="grid grid-cols-2 gap-3 max-w-lg">
          <div className="bg-white/10 rounded-xl p-4 border border-white/5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-2 text-cyan-400">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M1 11 Q4 8 8 11 Q12 14 15 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M1 7 Q4 4 8 7 Q12 10 15 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <div className="font-bold text-sm mb-1">Shared Resource</div>
            <div className="text-blue-300 text-xs">All teams fish from the same ocean. One team's greed becomes everyone's loss.</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 border border-white/5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-2 text-cyan-400">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M4 7H2M4 9H2M12 7H14M12 9H14M7 4V2M9 4V2M7 12V14M9 12V14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/></svg>
            </div>
            <div className="font-bold text-sm mb-1">AI fills empty slots</div>
            <div className="text-blue-300 text-xs">Missing players? AI teams fill open slots on Easy or Hard difficulty.</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 border border-white/5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-2 text-cyan-400">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M2 11 L5 7.5 L8 9.5 L11 4.5 L14 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="2" y1="13.5" x2="14" y2="13.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5"/></svg>
            </div>
            <div className="font-bold text-sm mb-1">Live Analysis</div>
            <div className="text-blue-300 text-xs">See every team's balance and fish stock in real time throughout the session.</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 border border-white/5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-2 text-cyan-400">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M8 13 Q4 11.5 2 12.5 L2 3.5 Q4 2.5 8 4 Q12 2.5 14 3.5 L14 12.5 Q12 11.5 8 13Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/><line x1="8" y1="4" x2="8" y2="13" stroke="currentColor" strokeWidth="1.4"/></svg>
            </div>
            <div className="font-bold text-sm mb-1">Learning Game</div>
            <div className="text-blue-300 text-xs">Inspired by Hardin's Tragedy of the Commons. Can cooperation beat self-interest?</div>
          </div>
        </div>

        {/* Stats — unified strip with internal dividers */}
        <div className="grid grid-cols-3 max-w-lg mt-3 rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] text-xs text-blue-300">
          {[
            { value: `${GAME_CONFIG.initialBoote} ships`,                                          label: 'Starting fleet' },
            { value: `${GAME_CONFIG.startGuthaben.toLocaleString()}€`,                            label: 'Starting balance' },
            { value: `${GAME_CONFIG.startFischbestand.toLocaleString()} / ${GAME_CONFIG.maxFischbestand.toLocaleString()}`, label: 'Fish stock (start/max)' },
            { value: `${GAME_CONFIG.fischPreis}€ / fish`,                                         label: 'Fish price' },
            { value: `${GAME_CONFIG.bootKosten}€`,                                                label: 'New ship' },
            { value: `${GAME_CONFIG.auctionPreis}€`,                                              label: 'Auction price' },
          ].map((s, i) => (
            <div key={i} className={`px-3 py-2.5 text-center ${i % 3 < 2 ? 'border-r border-white/10' : ''} ${i < 3 ? 'border-b border-white/10' : ''}`}>
              <div className="font-bold text-white text-sm leading-tight">{s.value}</div>
              <div className="text-[10px] leading-tight mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — action */}
      <div className="w-96 flex flex-col justify-center px-10 py-12 bg-blue-950/60 border-l border-white/10">
        <h2 className="text-2xl font-bold mb-2">Start Game</h2>
        <p className="text-blue-300 text-sm mb-10">Host a session or join with a room code.</p>

        <div className="flex flex-col gap-4">
          <button
            onClick={onCreateGame}
            className="w-full bg-gradient-to-br from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-bold py-5 px-6 rounded-xl text-lg transition-all hover:-translate-y-0.5 shadow-lg hover:shadow-green-900/40 text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">Create Game</div>
                <div className="text-green-100 text-sm font-normal">Open a room as host</div>
              </div>
              <svg className="w-5 h-5 text-green-200 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </button>

          <button
            onClick={onJoinGame}
            className="w-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold py-5 px-6 rounded-xl text-lg transition-all hover:-translate-y-0.5 shadow-lg hover:shadow-blue-900/40 text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">Join Game</div>
                <div className="text-blue-100 text-sm font-normal">Enter with 4-letter room code</div>
              </div>
              <svg className="w-5 h-5 text-blue-200 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </button>

        </div>

        <div className="mt-12 bg-white/5 rounded-xl p-5 text-xs text-blue-400">
          <div className="font-bold text-blue-300 mb-2">How it works</div>
          <ol className="space-y-1.5 list-decimal list-inside">
            <li>Host opens a room and shares the 4-letter code</li>
            <li>Players join. Empty slots are taken by AI teams.</li>
            <li>Each round, choose how many ships to send out</li>
            <li>Fish sustainably. Or watch the stock collapse.</li>
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
