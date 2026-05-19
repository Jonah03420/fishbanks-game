import { useState, useEffect, useRef } from 'react'
import { GAME_CONFIG } from '../game/fishLogic'
import {
  generateRoomCode, createRoom, joinRoom, getRoom,
  updateSettings, startGame, leaveRoom,
} from '../game/lobbyStore'
import { getAdminSettings, hasNonDefaultSettings } from '../game/adminSettings'

const TEAM_COLORS = ['🔴', '🟡', '🟢', '🔵']
const AI_PERSONALITY_LABEL = { gierig: 'Greedy', kooperativ: 'Cooperative', rational: 'Rational' }

function PlayerList({ room, myId }) {
  const numSlots = room.numTeams || 4
  const personalities = room.aiPersonalities || [null, 'gierig', 'kooperativ', 'rational']
  return (
    <div className="space-y-2">
      {Array.from({ length: numSlots }, (_, slot) => {
        const player = room.players[slot]
        if (player) return (
          <div key={slot} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
            <span className="text-xl">{TEAM_COLORS[slot]}</span>
            <span className="flex-1 font-medium">
              {player.name}
              {player.isCreator && <span className="text-xs text-yellow-300 ml-2">Host</span>}
              {player.id === myId && <span className="text-xs text-blue-300 ml-2">(You)</span>}
            </span>
            <span className="text-green-400 text-sm">Connected</span>
          </div>
        )
        const pLabel = personalities[slot] ? AI_PERSONALITY_LABEL[personalities[slot]] : '–'
        return (
          <div key={slot} className="flex items-center gap-3 bg-white/5 border border-dashed border-white/20 rounded-xl px-4 py-3 text-blue-400">
            <span className="text-xl opacity-30">{TEAM_COLORS[slot]}</span>
            <span className="flex-1 text-sm">
              {slot === 0 ? 'Waiting for host…' : `🤖 AI Player – ${pLabel}`}
            </span>
            <span className="text-xs text-blue-600">replaced when joined</span>
          </div>
        )
      })}
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

export default function LobbyPage({ onStart, onBack, initialView = 'create', onOpenAdmin }) {
  const [view, setView] = useState(initialView)
  const [playerName, setPlayerName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [room, setRoom] = useState(null)
  const [myId, setMyId] = useState(null)

  const roomRef = useRef(null)
  const myIdRef = useRef(null)
  useEffect(() => { roomRef.current = room }, [room])
  useEffect(() => { myIdRef.current = myId }, [myId])

  useEffect(() => {
    const isWaiting = view === 'waiting-host' || view === 'waiting-guest'
    if (!isWaiting) return

    function checkRoom() {
      const r = roomRef.current
      const id = myIdRef.current
      if (!r || !id) return
      const updated = getRoom(r.code)
      if (!updated) return
      setRoom(updated)
      if (updated.status === 'started') {
        const idx = updated.players.findIndex(p => p.id === id)
        if (idx !== -1) onStart(updated, idx)
      }
    }

    const interval = setInterval(checkRoom, 500)
    window.addEventListener('storage', checkRoom)
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', checkRoom)
    }
  }, [view, onStart])

  function doCreate() {
    const name = playerName.trim() || 'Player 1'
    const code = generateRoomCode()
    const admin = getAdminSettings()
    const result = createRoom({
      code,
      creatorName: name,
      maxRunden: admin.maxRunden,
      maxHumanPlayers: admin.numTeams,
      schwierigkeitsgrad: admin.schwierigkeitsgrad,
      startGuthaben: admin.startingCapital,
      startBoote: admin.startBoote,
      // All admin params forwarded to room (lobbyStore spreads ...adminParams)
      numTeams: admin.numTeams,
      startingCapital: admin.startingCapital,
      fishPrice: admin.fishPrice,
      newShipPrice: admin.newShipPrice,
      interestRate: admin.interestRate,
      operatingCostPerShip: admin.operatingCostPerShip,
      maxFishPopulation: admin.maxFishPopulation,
      startingFishStock: admin.startingFishStock,
      fishReproductionRate: admin.fishReproductionRate,
      aiPersonalities: admin.aiPersonalities,
      showFishStock: admin.showFishStock,
      showOtherCatches: admin.showOtherCatches,
    })
    setRoom(result.room)
    setMyId(result.myId)
    setView('waiting-host')
  }

  function doJoin() {
    setJoinError('')
    const name = playerName.trim() || 'Player'
    const code = joinCode.toUpperCase().replace(/[^A-Z]/g, '')
    if (code.length !== 4) { setJoinError('Please enter a 4-letter code.'); return }
    const result = joinRoom(code, name)
    if (result.error) { setJoinError(result.error); return }
    setRoom(result.room)
    setMyId(result.myId)
    setView('waiting-guest')
  }

  function changeSetting(key, value) {
    if (!room) return
    const next = updateSettings(room.code, { [key]: value })
    if (next) setRoom(next)
  }

  function doStartGame() {
    if (!room) return
    const updated = startGame(room.code)
    if (updated) {
      const idx = updated.players.findIndex(p => p.id === myId)
      if (idx !== -1) onStart(updated, idx)
    }
  }

  function doLeave() {
    if (room && myId) leaveRoom(room.code, myId)
    setRoom(null)
    setMyId(null)
    onBack()
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
          <div className="flex flex-col gap-3 mt-auto">
            <button onClick={doCreate}
              className="w-full bg-green-500 hover:bg-green-400 font-bold py-4 rounded-xl text-lg transition-colors">
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
            {joinError && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-red-200 text-sm text-center">
                {joinError}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={doJoin}
              className="w-full bg-blue-500 hover:bg-blue-400 font-bold py-4 rounded-xl text-lg transition-colors">
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

  // ── waiting-host ────────────────────────────────────────────────────────────
  if (view === 'waiting-host' && room) return (
    <div className="w-full h-full bg-blue-900 text-white flex overflow-hidden">

      <div className="flex-1 flex flex-col justify-center px-16 py-12 bg-gradient-to-br from-blue-800 to-blue-950 gap-6">
        <div>
          <p className="text-blue-200 text-sm mb-3">Room code – share with participants</p>
          <div className="bg-white/15 border-2 border-white/30 rounded-2xl px-10 py-5 inline-block mb-6">
            <div className="text-6xl font-bold tracking-widest font-mono">{room.code}</div>
          </div>
        </div>

        <div>
          <p className="text-sm text-blue-200 mb-3">
            Players ({room.players.length} / 4 slots filled)
          </p>
          <div className="max-w-md">
            <PlayerList room={room} myId={myId} />
          </div>
        </div>
      </div>

      <div className="w-[420px] flex flex-col justify-center px-10 py-8 bg-blue-950/60 border-l border-white/10 gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold mb-1">Settings</h2>
            <p className="text-blue-300 text-sm">You are host – configure the game.</p>
            {hasNonDefaultSettings() && (
              <div className="mt-1.5 text-xs text-yellow-300 bg-yellow-500/15 border border-yellow-400/30 rounded-lg px-2 py-1 inline-block">
                Custom instructor settings active
              </div>
            )}
          </div>
          {onOpenAdmin && (
            <button onClick={onOpenAdmin} className="text-blue-500 hover:text-blue-300 text-xs transition-colors flex-none">
              ⚙ Instructor
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm text-blue-200 mb-2">Rounds</label>
          <div className="grid grid-cols-3 gap-2">
            {[10, 15, 20].map(r => (
              <button key={r}
                onClick={() => changeSetting('maxRunden', r)}
                className={`py-3 rounded-xl font-bold text-sm transition-colors ${room.maxRunden === r ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-blue-200 mb-2">AI Difficulty</label>
          <div className="grid grid-cols-2 gap-2">
            {[['leicht', 'Easy'], ['schwer', 'Hard']].map(([val, lbl]) => (
              <button key={val}
                onClick={() => changeSetting('schwierigkeitsgrad', val)}
                className={`py-3 rounded-xl font-bold text-sm transition-colors ${(room.schwierigkeitsgrad || 'leicht') === val ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'}`}>
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
                onClick={() => changeSetting('startingCapital', n)}
                className={`py-2 rounded-xl font-bold text-xs transition-colors ${(room.startingCapital || room.startGuthaben || GAME_CONFIG.startGuthaben) === n ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'}`}>
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
                onClick={() => changeSetting('startBoote', n)}
                className={`py-2 rounded-xl font-bold text-sm transition-colors ${(room.startBoote || GAME_CONFIG.initialBoote) === n ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'}`}>
                {n} ships
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-auto">
          <button onClick={doStartGame}
            className="w-full bg-green-500 hover:bg-green-400 font-bold py-4 rounded-xl text-lg transition-colors">
            Start Game
          </button>
          <button onClick={doLeave} className="w-full text-blue-300 hover:text-white text-sm transition-colors py-2">
            ← Leave Room
          </button>
        </div>
      </div>
    </div>
  )

  // ── waiting-guest ───────────────────────────────────────────────────────────
  if (view === 'waiting-guest' && room) return (
    <div className="w-full h-full bg-blue-900 text-white flex overflow-hidden">

      <div className="flex-1 flex flex-col justify-center px-16 py-12 bg-gradient-to-br from-blue-800 to-blue-950 gap-6">
        <div>
          <p className="text-blue-200 text-sm mb-3">You joined – Room code</p>
          <div className="bg-white/15 border-2 border-white/30 rounded-2xl px-10 py-5 inline-block mb-6">
            <div className="text-6xl font-bold tracking-widest font-mono">{room.code}</div>
          </div>
        </div>

        <div>
          <p className="text-sm text-blue-200 mb-3">
            Players ({room.players.length} / 4 slots · {room.maxRunden} rounds)
          </p>
          <div className="max-w-md">
            <PlayerList room={room} myId={myId} />
          </div>
        </div>
      </div>

      <div className="w-[420px] flex flex-col justify-center px-10 py-12 bg-blue-950/60 border-l border-white/10 gap-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Waiting for Host</h2>
          <p className="text-blue-300 text-sm">You have successfully joined. The host will start the game.</p>
        </div>

        <div className="bg-white/5 rounded-xl p-6 text-center border border-white/10">
          <p className="text-blue-300 text-sm">Waiting for host to start the game…</p>
          <p className="text-blue-400 text-xs mt-2">This page updates automatically.</p>
        </div>

        <div className="bg-white/10 rounded-xl p-4 text-sm text-blue-300">
          <div className="font-bold text-white mb-2">Game Info</div>
          <div>{room.maxRunden} rounds</div>
          <div>{room.players.length} Human · {4 - room.players.length} AI (so far)</div>
        </div>

        <div className="mt-auto">
          <button onClick={doLeave} className="w-full text-blue-300 hover:text-white text-sm transition-colors py-2">
            ← Leave Room
          </button>
        </div>
      </div>
    </div>
  )

  return null
}
