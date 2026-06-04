import { useState, useEffect } from 'react'
import StartPage from './pages/StartPage'
import LobbyPage from './pages/LobbyPage'
import GamePage from './pages/GamePage'
import EndPage from './pages/EndPage'
import AdminPage from './pages/AdminPage'
import { useSocket } from './hooks/useSocket'

function App() {
  const { socket, connected } = useSocket()
  const [gameState, setGameState] = useState(null)
  const [phase, setPhase] = useState('start')
  const [lobbyView, setLobbyView] = useState('create')
  const [adminReturnPhase, setAdminReturnPhase] = useState('start')
  const [mySlotIndex, setMySlotIndex] = useState(null)
  const [roomCode, setRoomCode] = useState(null)
  const [rejoinSession, setRejoinSession] = useState(null)

  function handleGameStart(serverGS, slotIndex, rCode) {
    setMySlotIndex(slotIndex)
    setRoomCode(rCode)
    setGameState({ ...serverGS, playerIndex: slotIndex })
    setPhase('game')
  }

  function handleRestart() {
    setGameState(null)
    setMySlotIndex(null)
    setRoomCode(null)
    setRejoinSession(null)
    setPhase('start')
  }

  function handleRejoin(session) {
    setRejoinSession(session)
    setLobbyView('join')
    setPhase('lobby')
  }

  function handleOpenAdmin() {
    setAdminReturnPhase(phase)
    setPhase('admin')
  }

  useEffect(() => {
    if (gameState?.phase === 'ende') {
      setPhase('ended')
    }
  }, [gameState?.phase])

  useEffect(() => {
    if (!socket) return

    function onRoundComplete({ gameState: gs }) {
      if (!roomCode) return
      if (import.meta.env.DEV) {
        console.log('round-complete received:', gs)
        console.log('verlauf in new gameState:', gs.verlauf)
      }
      // Merge server state into React state, preserving client-only playerIndex.
      // verlauf fallback guards against any edge case where server sends empty array.
      setGameState(prev => ({
        ...gs,
        playerIndex: prev?.playerIndex ?? null,
        verlauf: gs.verlauf?.length ? gs.verlauf : (prev?.verlauf ?? []),
      }))
    }

    function onGameEnded({ gameState: gs }) {
      if (!roomCode) return
      setGameState(gs)
      setPhase('ended')
    }

    socket.on('round-complete', onRoundComplete)
    socket.on('game-ended', onGameEnded)
    return () => {
      socket.off('round-complete', onRoundComplete)
      socket.off('game-ended', onGameEnded)
    }
  }, [socket, roomCode])

  if (phase === 'admin') {
    return <AdminPage onBack={() => setPhase(adminReturnPhase)} />
  }

  return (
    <div className="w-full h-full">
      {phase === 'start' && (
        <StartPage
          connected={connected}
          onCreateGame={() => { setLobbyView('create'); setPhase('lobby') }}
          onJoinGame={() => { setLobbyView('join'); setPhase('lobby') }}
          onOpenAdmin={handleOpenAdmin}
          onRejoin={handleRejoin}
        />
      )}
      {phase === 'lobby' && (
        <LobbyPage
          socket={socket}
          connected={connected}
          initialView={lobbyView}
          onStart={handleGameStart}
          onBack={() => { setRejoinSession(null); setPhase('start') }}
          onOpenAdmin={handleOpenAdmin}
          initialName={rejoinSession?.name ?? ''}
          initialCode={rejoinSession?.code ?? ''}
        />
      )}
      {phase === 'game' && gameState && (
        <GamePage
          gameState={gameState}
          setGameState={setGameState}
          socket={socket}
          mySlotIndex={mySlotIndex}
          roomCode={roomCode}
        />
      )}
      {phase === 'ended' && gameState && (
        <EndPage gameState={gameState} onRestart={handleRestart} />
      )}
    </div>
  )
}

export default App
