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
    setPhase('start')
  }

  function handleOpenAdmin() {
    setAdminReturnPhase(phase)
    setPhase('admin')
  }

  useEffect(() => {
    if (!socket) return
    function onGameEnded({ gameState: gs }) {
      setGameState(gs)
      setPhase('ended')
    }
    socket.on('game-ended', onGameEnded)
    return () => socket.off('game-ended', onGameEnded)
  }, [socket])

  if (gameState && (gameState.phase === 'ende' || gameState.fish?.current <= 0)) {
    return <EndPage gameState={gameState} onRestart={handleRestart} />
  }

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
        />
      )}
      {phase === 'lobby' && (
        <LobbyPage
          socket={socket}
          connected={connected}
          initialView={lobbyView}
          onStart={handleGameStart}
          onBack={() => setPhase('start')}
          onOpenAdmin={handleOpenAdmin}
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
