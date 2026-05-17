import { useState, useEffect, useRef } from 'react'
import {
  generateRoomCode, createRoom, joinRoom, getRoom,
  updateSettings, startGame, leaveRoom,
} from '../game/lobbyStore'

const TEAM_COLORS = ['🔴', '🟡', '🟢', '🔵']
const AI_LABELS = ['Gierig', 'Kooperativ', 'Rational']

function PlayerList({ room, myId }) {
  const { players, maxHumanPlayers } = room
  const aiCount = 4 - maxHumanPlayers

  return (
    <div className="space-y-2">
      {players.map((p, i) => (
        <div key={p.id} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
          <span className="text-xl">{TEAM_COLORS[i]}</span>
          <span className="flex-1 font-medium">
            {p.name}
            {p.isCreator && <span className="text-xs text-yellow-300 ml-2">👑 Host</span>}
            {p.id === myId && <span className="text-xs text-blue-300 ml-2">(Du)</span>}
          </span>
          <span className="text-green-400 text-sm">✓ Verbunden</span>
        </div>
      ))}

      {Array.from({ length: maxHumanPlayers - players.length }, (_, i) => (
        <div key={`empty-${i}`} className="flex items-center gap-3 border border-dashed border-white/20 rounded-xl px-4 py-3 text-blue-400">
          <span className="text-xl opacity-40">{TEAM_COLORS[players.length + i]}</span>
          <span className="flex-1 text-sm">Warte auf Spieler…</span>
        </div>
      ))}

      {Array.from({ length: aiCount }, (_, i) => (
        <div key={`ai-${i}`} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 text-blue-400">
          <span className="text-xl opacity-30">{TEAM_COLORS[maxHumanPlayers + i]}</span>
          <span className="flex-1 text-sm">🤖 KI – {AI_LABELS[i] || 'Neutral'}</span>
        </div>
      ))}
    </div>
  )
}

/* Shared two-column shell */
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

export default function LobbyPage({ onStart, onBack }) {
  const [view, setView] = useState('choose') // 'choose' | 'create' | 'join' | 'waiting-host' | 'waiting-guest'
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
    const name = playerName.trim() || 'Spieler 1'
    const code = generateRoomCode()
    const result = createRoom({ code, creatorName: name, maxRunden: 20, maxHumanPlayers: 2 })
    setRoom(result.room)
    setMyId(result.myId)
    setView('waiting-host')
  }

  function doJoin() {
    setJoinError('')
    const name = playerName.trim() || 'Spieler'
    const code = joinCode.toUpperCase().replace(/[^A-Z]/g, '')
    if (code.length !== 4) { setJoinError('Bitte gib einen 4-buchstabigen Code ein.'); return }
    const result = joinRoom(code, name)
    if (result.error) { setJoinError(result.error); return }
    setRoom(result.room)
    setMyId(result.myId)
    setView('waiting-guest')
  }

  function changeSetting(field, value) {
    if (!room) return
    const next = updateSettings(room.code, {
      maxRunden: field === 'maxRunden' ? value : room.maxRunden,
      maxHumanPlayers: field === 'maxHumanPlayers' ? value : room.maxHumanPlayers,
    })
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
    setView('choose')
  }

  // ── choose ──────────────────────────────────────────────────────────────────
  if (view === 'choose') return (
    <Layout
      leftContent={
        <>
          <div className="text-7xl mb-6">🐟</div>
          <h1 className="text-4xl font-bold mb-4">Multiplayer</h1>
          <p className="text-blue-200 text-lg mb-10 max-w-md">
            Spiele Fish Banks mit Freunden im selben Netzwerk. Ein Spieler erstellt einen Raum, die anderen treten per Code bei.
          </p>
          <div className="space-y-4 max-w-md">
            <div className="bg-white/10 rounded-2xl p-5 flex gap-4 items-start">
              <div className="text-2xl shrink-0">🆕</div>
              <div>
                <div className="font-bold mb-1">Spiel erstellen</div>
                <div className="text-blue-300 text-sm">Du bist Host, konfigurierst Runden & Spieleranzahl und startest das Spiel wenn alle bereit sind.</div>
              </div>
            </div>
            <div className="bg-white/10 rounded-2xl p-5 flex gap-4 items-start">
              <div className="text-2xl shrink-0">🔗</div>
              <div>
                <div className="font-bold mb-1">Spiel beitreten</div>
                <div className="text-blue-300 text-sm">Gib den 4-stelligen Raum-Code ein, den der Host mit dir geteilt hat.</div>
              </div>
            </div>
          </div>
        </>
      }
      rightContent={
        <>
          <h2 className="text-2xl font-bold mb-2">Spielmodus wählen</h2>
          <p className="text-blue-300 text-sm mb-8">Erstelle einen neuen Raum oder tritt einem bestehenden bei.</p>
          <div className="flex flex-col gap-4 mb-8">
            <button onClick={() => setView('create')}
              className="w-full bg-green-500 hover:bg-green-400 font-bold py-5 px-6 rounded-2xl text-lg transition-colors text-left flex items-center gap-4">
              <span className="text-3xl">🆕</span>
              <div>
                <div className="font-bold">Spiel erstellen</div>
                <div className="text-green-100 text-sm font-normal">Als Host einen Raum eröffnen</div>
              </div>
            </button>
            <button onClick={() => setView('join')}
              className="w-full bg-blue-500 hover:bg-blue-400 font-bold py-5 px-6 rounded-2xl text-lg transition-colors text-left flex items-center gap-4">
              <span className="text-3xl">🔗</span>
              <div>
                <div className="font-bold">Spiel beitreten</div>
                <div className="text-blue-100 text-sm font-normal">Mit Raum-Code eintreten</div>
              </div>
            </button>
          </div>
          <button onClick={onBack} className="w-full text-blue-300 hover:text-white text-sm transition-colors py-2">
            ← Zurück zur Startseite
          </button>
        </>
      }
    />
  )

  // ── create ──────────────────────────────────────────────────────────────────
  if (view === 'create') return (
    <Layout
      leftContent={
        <>
          <h2 className="text-3xl font-bold mb-4">Raum erstellen</h2>
          <p className="text-blue-200 mb-8 max-w-md">
            Du wirst Host des Spiels. Nach dem Erstellen erhältst du einen 4-stelligen Raum-Code, den du mit Freunden teilen kannst.
          </p>
          <div className="space-y-4 max-w-md">
            <div className="bg-white/10 rounded-2xl p-5">
              <div className="font-bold mb-2">👑 Als Host kannst du:</div>
              <ul className="text-blue-300 text-sm space-y-1.5 list-disc list-inside">
                <li>Die Rundenzahl konfigurieren (10, 15 oder 20)</li>
                <li>Die maximale Spieleranzahl festlegen (1–4)</li>
                <li>Das Spiel starten, sobald alle bereit sind</li>
              </ul>
            </div>
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
              <div className="text-sm text-blue-300">
                Fehlende Plätze werden automatisch von KI-Teams aufgefüllt – du brauchst nicht auf alle Spieler zu warten.
              </div>
            </div>
          </div>
        </>
      }
      rightContent={
        <>
          <h2 className="text-2xl font-bold mb-2">🆕 Spiel erstellen</h2>
          <p className="text-blue-300 text-sm mb-8">Gib deinen Namen ein und erstelle einen Raum.</p>
          <div className="mb-6">
            <label className="block text-sm text-blue-200 mb-2">👤 Dein Name</label>
            <input
              type="text"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doCreate()}
              placeholder="Spieler 1"
              maxLength={20}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300 focus:outline-none focus:border-blue-400 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-3 mt-auto">
            <button onClick={doCreate}
              className="w-full bg-green-500 hover:bg-green-400 font-bold py-4 rounded-xl text-lg transition-colors">
              ✅ Raum erstellen
            </button>
            <button onClick={() => setView('choose')} className="w-full text-blue-300 hover:text-white text-sm transition-colors py-2">
              ← Zurück
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
          <h2 className="text-3xl font-bold mb-4">Raum beitreten</h2>
          <p className="text-blue-200 mb-8 max-w-md">
            Gib den 4-stelligen Code ein, den der Host des Spiels mit dir geteilt hat.
          </p>
          <div className="bg-white/10 rounded-2xl p-6 max-w-md">
            <div className="font-bold mb-3">💡 Wo ist der Code?</div>
            <p className="text-blue-300 text-sm">
              Der Host sieht den Raum-Code direkt nach dem Erstellen des Raums – er wird groß auf seinem Bildschirm angezeigt.
              Frag ihn einfach danach oder schau auf seinen Bildschirm.
            </p>
          </div>
        </>
      }
      rightContent={
        <>
          <h2 className="text-2xl font-bold mb-2">🔗 Spiel beitreten</h2>
          <p className="text-blue-300 text-sm mb-8">Name eingeben und Code eintippen.</p>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm text-blue-200 mb-2">👤 Dein Name</label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Spieler 2"
                maxLength={20}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300 focus:outline-none focus:border-blue-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-blue-200 mb-2">🔑 Raum-Code</label>
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
                ❌ {joinError}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={doJoin}
              className="w-full bg-blue-500 hover:bg-blue-400 font-bold py-4 rounded-xl text-lg transition-colors">
              🔗 Beitreten
            </button>
            <button onClick={() => setView('choose')} className="w-full text-blue-300 hover:text-white text-sm transition-colors py-2">
              ← Zurück
            </button>
          </div>
        </>
      }
    />
  )

  // ── waiting-host ────────────────────────────────────────────────────────────
  if (view === 'waiting-host' && room) {
    const canStart = room.players.length >= 1

    return (
      <div className="w-full h-full bg-blue-900 text-white flex overflow-hidden">

        {/* Left: room code + players */}
        <div className="flex-1 flex flex-col justify-center px-16 py-12 bg-gradient-to-br from-blue-800 to-blue-950 gap-6">
          <div>
            <p className="text-blue-200 text-sm mb-3">Raum-Code – teile ihn mit Freunden</p>
            <div className="bg-white/15 border-2 border-white/30 rounded-2xl px-10 py-5 inline-block mb-6">
              <div className="text-6xl font-bold tracking-widest font-mono">{room.code}</div>
            </div>
          </div>

          <div>
            <p className="text-sm text-blue-200 mb-3">
              👥 Spieler ({room.players.length}/{room.maxHumanPlayers} Mensch · {4 - room.maxHumanPlayers} KI)
            </p>
            <div className="max-w-md">
              <PlayerList room={room} myId={myId} />
            </div>
          </div>
        </div>

        {/* Right: settings + controls */}
        <div className="w-[420px] flex flex-col justify-center px-10 py-12 bg-blue-950/60 border-l border-white/10 gap-6">
          <div>
            <h2 className="text-2xl font-bold mb-1">⚙️ Einstellungen</h2>
            <p className="text-blue-300 text-sm">Du bist Host – konfiguriere das Spiel.</p>
          </div>

          <div>
            <label className="block text-sm text-blue-200 mb-2">🔄 Runden</label>
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
            <label className="block text-sm text-blue-200 mb-2">👥 Max. Mitspieler</label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map(n => (
                <button key={n}
                  onClick={() => { if (n >= room.players.length) changeSetting('maxHumanPlayers', n) }}
                  disabled={n < room.players.length}
                  className={`py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${room.maxHumanPlayers === n ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-auto">
            <button onClick={doStartGame} disabled={!canStart}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed font-bold py-4 rounded-xl text-lg transition-colors">
              🚀 Spiel starten
            </button>
            <button onClick={doLeave} className="w-full text-blue-300 hover:text-white text-sm transition-colors py-2">
              ← Raum verlassen
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── waiting-guest ───────────────────────────────────────────────────────────
  if (view === 'waiting-guest' && room) return (
    <div className="w-full h-full bg-blue-900 text-white flex overflow-hidden">

      {/* Left: room code + players */}
      <div className="flex-1 flex flex-col justify-center px-16 py-12 bg-gradient-to-br from-blue-800 to-blue-950 gap-6">
        <div>
          <p className="text-blue-200 text-sm mb-3">Du bist beigetreten – Raum-Code</p>
          <div className="bg-white/15 border-2 border-white/30 rounded-2xl px-10 py-5 inline-block mb-6">
            <div className="text-6xl font-bold tracking-widest font-mono">{room.code}</div>
          </div>
        </div>

        <div>
          <p className="text-sm text-blue-200 mb-3">
            👥 Spieler ({room.players.length}/{room.maxHumanPlayers} · {room.maxRunden} Runden)
          </p>
          <div className="max-w-md">
            <PlayerList room={room} myId={myId} />
          </div>
        </div>
      </div>

      {/* Right: status */}
      <div className="w-[420px] flex flex-col justify-center px-10 py-12 bg-blue-950/60 border-l border-white/10 gap-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Warten auf Host</h2>
          <p className="text-blue-300 text-sm">Du bist erfolgreich beigetreten. Der Host startet das Spiel.</p>
        </div>

        <div className="bg-white/5 rounded-2xl p-6 text-center border border-white/10">
          <div className="text-4xl mb-3 animate-pulse">⏳</div>
          <p className="text-blue-300 text-sm">Warte auf den Host, das Spiel zu starten…</p>
          <p className="text-blue-400 text-xs mt-2">Diese Seite aktualisiert sich automatisch.</p>
        </div>

        <div className="bg-white/10 rounded-2xl p-4 text-sm text-blue-300">
          <div className="font-bold text-white mb-2">Spielinfo</div>
          <div>🔄 {room.maxRunden} Runden</div>
          <div>👥 {room.maxHumanPlayers} Mensch · {4 - room.maxHumanPlayers} KI</div>
        </div>

        <div className="mt-auto">
          <button onClick={doLeave} className="w-full text-blue-300 hover:text-white text-sm transition-colors py-2">
            ← Raum verlassen
          </button>
        </div>
      </div>
    </div>
  )

  return null
}
