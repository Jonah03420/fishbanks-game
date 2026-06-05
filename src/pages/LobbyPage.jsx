import { useState, useEffect } from 'react'

const COLOR_EMOJI = {
  red: '🔴', yellow: '🟡', green: '🟢',
  blue: '🔵', purple: '🟣', orange: '🟠'
}

function ConnectionStatus({ connected }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
      <span>{connected ? '🟢' : '🔴'}</span>
      {connected ? 'Connected to server' : 'Connecting...'}
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

function Layout({ leftContent, rightContent }) {
  return (
    <div className="w-full h-full bg-blue-900 text-white flex overflow-hidden">
      <div className="flex-1 flex flex-col justify-center px-16 py-12 bg-gradient-to-br from-blue-800 to-blue-950">
        {leftContent}
      </div>
      <div className="w-[420px] flex flex-col justify-center px-10 py-12 bg-blue-950/60 border-l border-white/10">
        {rightContent}
      </div>
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
      setRoom(r)
      setMySlotIndex(slotIndex)
      setIsHost(true)
      setError('')
      setView('waiting')
    }

    function onRoomJoined({ slotIndex, room: r }) {
      setRoom(r)
      setMySlotIndex(slotIndex)
      setIsHost(false)
      setError('')
      setView('waiting')
    }

    function onRoomUpdated({ room: r }) {
      setRoom(prev => prev?.code === r.code ? r : prev)
    }

    function onServerError({ message }) {
      setError(message)
    }

    function onKicked() {
      setRoom(null)
      setMySlotIndex(null)
      setIsHost(false)
      onBack()
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
    setRoom(null)
    setMySlotIndex(null)
    setIsHost(false)
    onBack()
  }

  function doStartGame() {
    if (!socket || !connected) { setError('Not connected to server.'); return }
    if (!room?.code) { setError('Room not found.'); return }
    const roomCode = room.code
    console.log('emitting start-game', roomCode)
    socket.emit('start-game', { roomCode })
  }

  // ── create ──────────────────────────────────────────────────────────────────
  if (view === 'create') return (
    <Layout
      leftContent={
        <>
          <h2 className="text-3xl font-bold mb-4">Create Room</h2>
          <p className="text-blue-200 mb-8 max-w-md">
            You will be the host of the game. After creating, you'll receive a 4-letter room code to share with participants.
          </p>
          <div className="space-y-4 max-w-md">
            <div className="bg-white/10 rounded-xl p-5">
              <div className="font-bold mb-2">As host you can:</div>
              <ul className="text-blue-300 text-sm space-y-1.5 list-disc list-inside">
                <li>Configure rounds, starting balance &amp; starting fleet</li>
                <li>Choose AI difficulty for empty slots</li>
                <li>Start the game once everyone is ready</li>
              </ul>
            </div>
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <div className="text-sm text-blue-300">
                Empty slots are automatically filled by AI teams – you don't need to wait for all players.
              </div>
            </div>
          </div>
        </>
      }
      rightContent={
        <>
          <div className="flex justify-end mb-6">
            <ConnectionStatus connected={connected} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Create Game</h2>
          <p className="text-blue-300 text-sm mb-8">Enter your name and create a room.</p>
          <div className="mb-6">
            <label className="block text-sm text-blue-200 mb-2">Your Name</label>
            <input
              type="text"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doCreate()}
              placeholder="Player 1"
              maxLength={20}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300 focus:outline-none focus:border-blue-400 transition-colors"
            />
          </div>
          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-red-200 text-sm text-center mb-4">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-3 mt-auto">
            <button onClick={doCreate} disabled={!connected}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-4 rounded-xl text-lg transition-colors">
              Create Room
            </button>
            <button onClick={onBack} className="w-full text-blue-300 hover:text-white text-sm transition-colors py-2">
              ← Back
            </button>
          </div>
        </>
      }
    />
  )

  // ── join ────────────────────────────────────────────────────────────────────
  if (view === 'join') return (
    <Layout
      leftContent={
        <>
          <h2 className="text-3xl font-bold mb-4">Join Room</h2>
          <p className="text-blue-200 mb-8 max-w-md">
            Enter the 4-letter code that the host of the game shared with you.
          </p>
          <div className="bg-white/10 rounded-xl p-6 max-w-md">
            <div className="font-bold mb-3">Where is the code?</div>
            <p className="text-blue-300 text-sm">
              The host sees the room code right after creating the room – it is displayed prominently on their screen.
            </p>
          </div>
        </>
      }
      rightContent={
        <>
          <div className="flex justify-end mb-6">
            <ConnectionStatus connected={connected} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Join Game</h2>
          <p className="text-blue-300 text-sm mb-8">Enter your name and type in the code.</p>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm text-blue-200 mb-2">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Player 2"
                maxLength={20}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300 focus:outline-none focus:border-blue-400 transition-colors"
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
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white placeholder-blue-300 text-center text-3xl font-bold tracking-widest focus:outline-none focus:border-blue-400 transition-colors uppercase"
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
              className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-4 rounded-xl text-lg transition-colors">
              Join
            </button>
            <button onClick={onBack} className="w-full text-blue-300 hover:text-white text-sm transition-colors py-2">
              ← Back
            </button>
          </div>
        </>
      }
    />
  )

  // ── waiting ──────────────────────────────────────────────────────────────────
  if (view === 'waiting' && room) {
    const s = room.settings
    const humanCount = room.slots.filter(sl => !sl.isAI).length
    const aiCount = room.slots.filter(sl => sl.isAI).length

    return (
      <div className="w-full h-full bg-blue-900 text-white flex overflow-hidden">

        <div className="flex-1 flex flex-col justify-center px-16 py-12 bg-gradient-to-br from-blue-800 to-blue-950 gap-6">
          <div>
            <p className="text-blue-200 text-sm mb-3">
              {isHost ? 'Room code – share with participants' : 'You joined – Room code'}
            </p>
            <div className="bg-white/15 border-2 border-white/30 rounded-2xl px-10 py-5 inline-block mb-2">
              <div className="text-6xl font-bold tracking-widest font-mono">{room.code}</div>
            </div>
            <p className="text-blue-400 text-xs">Share this code with other players</p>
          </div>

          <div>
            <p className="text-sm text-blue-200 mb-3">
              Players ({humanCount} human · {aiCount} AI)
            </p>
            <div className="max-w-md">
              <SlotList slots={room.slots} mySlotIndex={mySlotIndex} />
            </div>
          </div>
        </div>

        <div className="w-[420px] flex flex-col px-10 py-8 bg-blue-950/60 border-l border-white/10 gap-4 justify-center">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-2xl font-bold mb-1">
                {isHost ? 'Settings' : 'Waiting for Host'}
              </h2>
              <p className="text-blue-300 text-sm">
                {isHost
                  ? 'You are host – configure the game.'
                  : 'You have successfully joined. The host will start the game.'}
              </p>
            </div>
            <ConnectionStatus connected={connected} />
          </div>

          {isHost ? (
            <>
              <div>
                <label className="block text-sm text-blue-200 mb-2">Rounds</label>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 15, 20].map(r => (
                    <button key={r}
                      onClick={() => changeSetting('maxRounds', r)}
                      className={`py-3 rounded-xl font-bold text-sm transition-colors ${s.maxRounds === r ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-blue-200 mb-2">AI Difficulty</label>
                <div className="grid grid-cols-2 gap-2">
                  {[['easy', 'Easy'], ['hard', 'Hard']].map(([val, lbl]) => (
                    <button key={val}
                      onClick={() => changeSetting('aiDifficulty', val)}
                      className={`py-3 rounded-xl font-bold text-sm transition-colors ${s.aiDifficulty === val ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-blue-200 mb-2">Starting Balance</label>
                <div className="grid grid-cols-3 gap-2">
                  {[3000, 5000, 8000].map(n => (
                    <button key={n}
                      onClick={() => changeSetting('startingBalance', n)}
                      className={`py-2 rounded-xl font-bold text-xs transition-colors ${s.startingBalance === n ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'}`}>
                      {(n / 1000).toLocaleString()}k€
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-blue-200 mb-2">Starting Fleet</label>
                <div className="grid grid-cols-3 gap-2">
                  {[2, 3, 5].map(n => (
                    <button key={n}
                      onClick={() => changeSetting('startingFleet', n)}
                      className={`py-2 rounded-xl font-bold text-sm transition-colors ${s.startingFleet === n ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'}`}>
                      {n} ships
                    </button>
                  ))}
                </div>
              </div>

              {onOpenAdmin && (
                <button onClick={onOpenAdmin} className="text-blue-500 hover:text-blue-300 text-xs transition-colors text-left">
                  ⚙ Instructor Settings
                </button>
              )}

              <div className="flex flex-col gap-3 mt-auto">
                <button
                  onClick={doStartGame}
                  disabled={!connected}
                  className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-4 rounded-xl text-lg transition-colors">
                  Start Game
                </button>
                <button onClick={doLeave} className="w-full text-blue-300 hover:text-white text-sm transition-colors py-2">
                  ← Leave Room
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white/5 rounded-xl p-6 text-center border border-white/10">
                <p className="text-blue-300 text-sm">Waiting for host to start the game…</p>
                <p className="text-blue-400 text-xs mt-2">This page updates automatically.</p>
              </div>

              <div className="bg-white/10 rounded-xl p-4 text-sm text-blue-300">
                <div className="font-bold text-white mb-2">Game Settings</div>
                <div>{s.maxRounds} rounds</div>
                <div>{s.aiDifficulty === 'easy' ? 'Easy' : 'Hard'} AI</div>
                <div>Balance: {s.startingBalance.toLocaleString()}€ · Fleet: {s.startingFleet} ships</div>
              </div>

              <div className="mt-auto">
                <button onClick={doLeave} className="w-full text-blue-300 hover:text-white text-sm transition-colors py-2">
                  ← Leave Room
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return null
}
