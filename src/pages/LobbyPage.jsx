import { useState, useEffect } from 'react'

const COLOR_EMOJI = {
  red: '🔴', yellow: '🟡', green: '🟢',
  blue: '🔵', purple: '🟣', orange: '🟠'
}

function ConnectionStatus({ connected }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs flex-shrink-0 ${connected ? 'text-green-400' : 'text-red-400'}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-400 server-online' : 'bg-red-400'}`}/>
      {connected ? 'Connected' : 'Connecting…'}
    </div>
  )
}

function SlotList({ slots, mySlotIndex }) {
  return (
    <div className="space-y-2">
      {slots.map(slot => (
        <div key={slot.slotIndex}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
            slot.isAI
              ? 'bg-white/5 border border-dashed border-white/20 text-blue-400'
              : 'bg-white/10'
          }`}>
          <span className="text-xl">{COLOR_EMOJI[slot.color] || '⚪'}</span>
          <span className="flex-1 font-medium">
            {slot.name}
            {slot.slotIndex === 0 && !slot.isAI && (
              <span className="text-xs text-yellow-300 ml-2">Host</span>
            )}
            {slot.slotIndex === mySlotIndex && !slot.isAI && (
              <span className="text-xs text-blue-300 ml-2">(You)</span>
            )}
          </span>
          {slot.isAI
            ? <span className="text-xs text-blue-500">AI</span>
            : <span className="text-green-400 text-sm">Connected</span>
          }
        </div>
      ))}
    </div>
  )
}

function OceanBg({ children, wide = false }) {
  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-800 to-blue-950 text-white flex items-center justify-center overflow-hidden relative">
      {/* Glows */}
      <div className="absolute top-1/4 left-1/5 w-[500px] h-[500px] bg-cyan-400/[0.08] rounded-full blur-3xl pointer-events-none"/>
      <div className="absolute bottom-1/3 right-1/5 w-80 h-80 bg-blue-300/[0.07] rounded-full blur-2xl pointer-events-none"/>
      <div className="absolute top-2/3 left-1/2 w-64 h-64 bg-sky-300/[0.05] rounded-full blur-3xl pointer-events-none -translate-x-1/2"/>
      {/* Bubbles */}
      <div className="absolute bottom-24 left-24 w-2.5 h-2.5 bg-cyan-300/40 rounded-full bubble-float pointer-events-none" style={{animationDelay:'0s'}}/>
      <div className="absolute bottom-40 left-52 w-3.5 h-3.5 bg-blue-300/30 rounded-full bubble-float pointer-events-none" style={{animationDelay:'1.8s'}}/>
      <div className="absolute bottom-20 left-1/3 w-2 h-2 bg-cyan-200/40 rounded-full bubble-float pointer-events-none" style={{animationDelay:'3.2s'}}/>
      <div className="absolute bottom-32 right-48 w-4 h-4 bg-blue-400/25 rounded-full bubble-float pointer-events-none" style={{animationDelay:'0.6s'}}/>
      <div className="absolute bottom-16 right-28 w-2.5 h-2.5 bg-cyan-300/35 rounded-full bubble-float pointer-events-none" style={{animationDelay:'2.5s'}}/>
      <div className="absolute bottom-48 left-16 w-3 h-3 bg-blue-200/30 rounded-full bubble-float pointer-events-none" style={{animationDelay:'4.1s'}}/>
      <div className="absolute bottom-60 right-1/3 w-2 h-2 bg-sky-300/30 rounded-full bubble-float pointer-events-none" style={{animationDelay:'5.3s'}}/>
      {/* Waves */}
      <div className="absolute bottom-0 left-0 right-0 h-20 overflow-hidden pointer-events-none">
        <svg viewBox="0 0 2400 80" preserveAspectRatio="none" className="w-[200%] h-full wave-shift" style={{opacity:0.20}}>
          <path d="M0,40 C200,70 400,10 600,40 C800,70 1000,10 1200,40 C1400,70 1600,10 1800,40 C2000,70 2200,10 2400,40 L2400,80 L0,80 Z" fill="#7dd3fc"/>
        </svg>
      </div>
      {/* Card — z-10 keeps it above bubbles */}
      <div className={`relative z-10 w-full px-16 ${wide ? 'max-w-[1300px]' : 'max-w-[1100px]'} mx-auto`}>
        {children}
      </div>
    </div>
  )
}

function Card({ children, className = '' }) {
  return (
    <div className={`flex rounded-2xl overflow-hidden border border-white/10 shadow-2xl ${className}`}>
      {children}
    </div>
  )
}

export default function LobbyPage({ socket, connected, onStart, onBack, initialView = 'create', onOpenAdmin }) {
  const [view, setView] = useState(initialView)
  const [playerName, setPlayerName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [room, setRoom] = useState(null)
  const [mySlotIndex, setMySlotIndex] = useState(null)
  const [isHost, setIsHost] = useState(false)

  useEffect(() => {
    if (!socket) return

    function onRoomCreated({ slotIndex, room: r }) {
      setRoom(r); setMySlotIndex(slotIndex); setIsHost(true); setError(''); setView('waiting')
    }
    function onRoomJoined({ slotIndex, room: r }) {
      setRoom(r); setMySlotIndex(slotIndex); setIsHost(false); setError(''); setView('waiting')
    }
    function onRoomUpdated({ room: r }) {
      setRoom(prev => prev?.code === r.code ? r : prev)
    }
    function onServerError({ message }) { setError(message) }
    function onKicked() {
      setRoom(null); setMySlotIndex(null); setIsHost(false); onBack()
    }
    function onGameStarted({ gameState: gs, slotIndex: si }) {
      onStart(gs, si ?? mySlotIndex, room?.code)
    }

    socket.on('room-created', onRoomCreated)
    socket.on('room-joined', onRoomJoined)
    socket.on('room-updated', onRoomUpdated)
    socket.on('error', onServerError)
    socket.on('kicked', onKicked)
    socket.on('game-started', onGameStarted)
    return () => {
      socket.off('room-created', onRoomCreated)
      socket.off('room-joined', onRoomJoined)
      socket.off('room-updated', onRoomUpdated)
      socket.off('error', onServerError)
      socket.off('kicked', onKicked)
      socket.off('game-started', onGameStarted)
    }
  }, [socket, onBack, mySlotIndex, room])

  function doCreate() {
    if (!socket || !connected) { setError('Not connected to server.'); return }
    setError('')
    socket.emit('create-room', { playerName: playerName.trim() || 'Player 1', settings: {} })
  }

  function doJoin() {
    if (!socket || !connected) { setError('Not connected to server.'); return }
    setError('')
    const code = joinCode.toUpperCase().replace(/[^A-Z]/g, '')
    if (code.length !== 4) { setError('Please enter a 4-letter code.'); return }
    socket.emit('join-room', { playerName: playerName.trim() || 'Player', roomCode: code })
  }

  function changeSetting(key, value) {
    if (!room || !socket) return
    socket.emit('update-settings', { roomCode: room.code, settings: { [key]: value } })
  }

  function doLeave() {
    if (room && socket) socket.emit('leave-room', { roomCode: room.code })
    setRoom(null); setMySlotIndex(null); setIsHost(false); onBack()
  }

  function doStartGame() {
    if (!socket || !connected) { setError('Not connected to server.'); return }
    if (!room?.code) { setError('Room not found.'); return }
    socket.emit('start-game', { roomCode: room.code })
  }

  const featureCard = (icon, title, desc, accent = 'cyan') => (
    <div className="flex gap-3 bg-white/[0.06] rounded-xl p-4 border border-white/[0.05]">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${accent === 'cyan' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-500/20 text-blue-300'}`}>
        {icon}
      </div>
      <div>
        <div className="font-semibold text-sm text-white mb-0.5">{title}</div>
        <div className="text-blue-300 text-xs leading-relaxed">{desc}</div>
      </div>
    </div>
  )

  // ── create ──────────────────────────────────────────────────────────────────
  if (view === 'create') return (
    <OceanBg>
      <Card>
        {/* Left — info */}
        <div className="flex-1 flex flex-col justify-center px-12 py-12 bg-white/[0.03]">
          <h2 className="text-5xl font-bold mb-3">Create Room</h2>
          <p className="text-blue-200 text-lg mb-8 max-w-lg leading-relaxed">
            Open a room as host, invite teams, and start the game when everyone is ready.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {featureCard(
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M4 7H2M4 9H2M12 7H14M12 9H14M7 4V2M9 4V2M7 12V14M9 12V14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/></svg>,
              'AI fills empty slots', 'No need to wait for all players.'
            )}
            {featureCard(
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
              'Configure first', 'Set rounds, AI difficulty and fleet.'
            )}
            {featureCard(
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M5 7h6M5 9.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
              'Share the room code', 'Players join from any device.'
            )}
            {featureCard(
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.8 3.6L14 6.4l-3 2.9.7 4.1L8 11.4l-3.7 2 .7-4.1-3-2.9 4.2-.8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
              'You control the start', 'Start once everyone is ready.'
            )}
          </div>
        </div>

        {/* Right — form */}
        <div className="w-[380px] flex flex-col justify-center px-10 py-12 bg-blue-950/50 border-l border-white/10">
          <div className="flex justify-end mb-8">
            <ConnectionStatus connected={connected} />
          </div>

          <div className="mb-8">
            <label className="block text-sm text-blue-200 mb-2">Your Name</label>
            <input
              type="text"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doCreate()}
              placeholder="Player 1"
              maxLength={20}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-400 focus:outline-none focus:border-blue-400 transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-red-200 text-sm text-center mb-4">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button onClick={doCreate} disabled={!connected}
              className="w-full bg-gradient-to-br from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl text-base transition-all hover:-translate-y-0.5 shadow-lg group flex items-center justify-between">
              <span>Create Room</span>
              <svg className="w-5 h-5 text-green-200 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button onClick={onBack} className="w-full text-blue-400 hover:text-white text-sm transition-colors py-2">
              ← Back
            </button>
          </div>
        </div>
      </Card>
    </OceanBg>
  )

  // ── join ────────────────────────────────────────────────────────────────────
  if (view === 'join') return (
    <OceanBg>
      <Card>
        {/* Left — info */}
        <div className="flex-1 flex flex-col justify-center px-12 py-12 bg-white/[0.03]">
          <h2 className="text-5xl font-bold mb-3">Join Room</h2>
          <p className="text-blue-200 text-lg mb-8 max-w-lg leading-relaxed">
            Enter the 4-letter code that the host shared with you to join the session.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {featureCard(
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M8 13 Q4 11.5 2 12.5 L2 3.5 Q4 2.5 8 4 Q12 2.5 14 3.5 L14 12.5 Q12 11.5 8 13Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/><line x1="8" y1="4" x2="8" y2="13" stroke="currentColor" strokeWidth="1.4"/></svg>,
              'Where is the code?', 'The host sees it right after creating the room.',
              'blue'
            )}
            {featureCard(
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M1 11 Q4 8 8 11 Q12 14 15 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M1 7 Q4 4 8 7 Q12 10 15 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
              'Any device works', 'Laptop, tablet, or phone.',
              'blue'
            )}
          </div>
        </div>

        {/* Right — form */}
        <div className="w-[380px] flex flex-col justify-center px-10 py-12 bg-blue-950/50 border-l border-white/10">
          <div className="flex justify-end mb-8">
            <ConnectionStatus connected={connected} />
          </div>

          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-sm text-blue-200 mb-2">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Player 2"
                maxLength={20}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-400 focus:outline-none focus:border-blue-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-blue-200 mb-2">Room Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                onKeyDown={e => e.key === 'Enter' && doJoin()}
                placeholder="ABCD"
                maxLength={4}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white placeholder-blue-400/60 text-center text-3xl font-bold tracking-widest focus:outline-none focus:border-blue-400 transition-colors uppercase"
              />
            </div>
            {error && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-red-200 text-sm text-center">
                {error}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button onClick={doJoin} disabled={!connected}
              className="w-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl text-base transition-all hover:-translate-y-0.5 shadow-lg group flex items-center justify-between">
              <span>Join Room</span>
              <svg className="w-5 h-5 text-blue-200 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button onClick={onBack} className="w-full text-blue-400 hover:text-white text-sm transition-colors py-2">
              ← Back
            </button>
          </div>
        </div>
      </Card>
    </OceanBg>
  )

  // ── waiting ──────────────────────────────────────────────────────────────────
  if (view === 'waiting' && room) {
    const s = room.settings
    const humanCount = room.slots.filter(sl => !sl.isAI).length
    const aiCount = room.slots.filter(sl => sl.isAI).length

    return (
      <OceanBg wide>
        <Card>
          {/* Left — room code + players */}
          <div className="flex-1 flex flex-col justify-center px-12 py-12 bg-white/[0.03]">
            <div className="mb-8">
              <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-3">
                {isHost ? 'Room code — share with participants' : 'You joined — Room code'}
              </p>
              <div className="bg-white/10 border border-white/20 rounded-2xl px-10 py-5 inline-block mb-2">
                <div className="text-6xl font-bold tracking-widest font-mono">{room.code}</div>
              </div>
              <p className="text-blue-400 text-xs mt-2">Share this code with other players</p>
            </div>
            <div>
              <p className="text-sm text-blue-300 font-medium mb-3">
                Players ({humanCount} human · {aiCount} AI)
              </p>
              <SlotList slots={room.slots} mySlotIndex={mySlotIndex} />
            </div>
          </div>

          {/* Right — settings or waiting */}
          <div className="w-[420px] flex flex-col px-10 py-10 bg-blue-950/50 border-l border-white/10 gap-4 justify-center">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h2 className="text-2xl font-bold">
                  {isHost ? 'Game Settings' : 'Waiting for Host'}
                </h2>
                <p className="text-blue-400 text-sm mt-1">
                  {isHost ? 'Configure before starting.' : 'The host will start the game soon.'}
                </p>
              </div>
              <ConnectionStatus connected={connected} />
            </div>

            {isHost ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Rounds</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[10, 15, 20].map(r => (
                      <button key={r} onClick={() => changeSetting('maxRounds', r)}
                        className={`py-3 rounded-xl font-bold text-sm transition-colors ${s.maxRounds === r ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">AI Difficulty</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[['easy', 'Easy'], ['hard', 'Hard']].map(([val, lbl]) => (
                      <button key={val} onClick={() => changeSetting('aiDifficulty', val)}
                        className={`py-3 rounded-xl font-bold text-sm transition-colors ${
                          s.aiDifficulty === val
                            ? val === 'easy' ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
                            : 'bg-white/10 hover:bg-white/20 text-blue-200'
                        }`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Starting Balance</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[3000, 5000, 8000].map(n => (
                      <button key={n} onClick={() => changeSetting('startingBalance', n)}
                        className={`py-2 rounded-xl font-bold text-xs transition-colors ${s.startingBalance === n ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'}`}>
                        {(n / 1000).toLocaleString()}k€
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Starting Fleet</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[2, 3, 5].map(n => (
                      <button key={n} onClick={() => changeSetting('startingFleet', n)}
                        className={`py-2 rounded-xl font-bold text-sm transition-colors ${s.startingFleet === n ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'}`}>
                        {n} ships
                      </button>
                    ))}
                  </div>
                </div>
                {onOpenAdmin && (
                  <button onClick={onOpenAdmin} className="text-blue-500 hover:text-blue-300 text-xs transition-colors text-left flex items-center gap-1.5">
                    <span className="w-3 h-3 flex items-center justify-center text-[10px] leading-none">⚙</span>
                    Instructor Settings
                  </button>
                )}
                <div className="flex flex-col gap-3 mt-2">
                  <button onClick={doStartGame} disabled={!connected}
                    className="w-full bg-gradient-to-br from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-4 px-6 rounded-xl text-base transition-all hover:-translate-y-0.5 shadow-lg group flex items-center justify-between">
                    <span>Start Game</span>
                    <svg className="w-5 h-5 text-green-200 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button onClick={doLeave} className="w-full text-blue-400 hover:text-white text-sm transition-colors py-2">
                    ← Leave Room
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-white/5 rounded-xl p-5 text-center border border-white/10">
                  <div className="w-8 h-8 rounded-full border-2 border-blue-400/40 border-t-blue-400 animate-spin mx-auto mb-3"/>
                  <p className="text-blue-200 text-sm font-medium">Waiting for host to start…</p>
                  <p className="text-blue-400 text-xs mt-1">This page updates automatically.</p>
                </div>
                <div className="bg-white/[0.06] rounded-xl p-4 border border-white/[0.05]">
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">Game Settings</div>
                  <div className="space-y-1.5 text-sm text-blue-200">
                    <div className="flex justify-between"><span className="text-blue-400">Rounds</span><span>{s.maxRounds}</span></div>
                    <div className="flex justify-between"><span className="text-blue-400">AI difficulty</span><span>{s.aiDifficulty === 'easy' ? 'Easy' : 'Hard'}</span></div>
                    <div className="flex justify-between"><span className="text-blue-400">Starting balance</span><span>{s.startingBalance.toLocaleString()}€</span></div>
                    <div className="flex justify-between"><span className="text-blue-400">Starting fleet</span><span>{s.startingFleet} ships</span></div>
                  </div>
                </div>
                <div className="mt-auto">
                  <button onClick={doLeave} className="w-full text-blue-400 hover:text-white text-sm transition-colors py-2">
                    ← Leave Room
                  </button>
                </div>
              </>
            )}
          </div>
        </Card>
      </OceanBg>
    )
  }

  return null
}
