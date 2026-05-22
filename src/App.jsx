import { useState } from 'react'
import StartPage from './pages/StartPage'
import LobbyPage from './pages/LobbyPage'
import GamePage from './pages/GamePage'
import EndPage from './pages/EndPage'
import AdminPage from './pages/AdminPage'
import { erstelleStartzustandAusLobby } from './game/gameState'
import { useSocket } from './hooks/useSocket'

function App() {
  const { socket, connected } = useSocket()
  const [gameState, setGameState] = useState(null)
  const [phase, setPhase] = useState('start')
  const [lobbyView, setLobbyView] = useState('create')
  const [adminReturnPhase, setAdminReturnPhase] = useState('start')

  function handleGameStart(room, playerIndex) {
    setGameState(erstelleStartzustandAusLobby(room, playerIndex))
    setPhase('game')
  }

  function handleRestart() {
    setGameState(null)
    setPhase('start')
  }

  function handleOpenAdmin() {
    setAdminReturnPhase(phase)
    setPhase('admin')
  }

  if (gameState && (gameState.phase === 'ende' || gameState.fischbestand <= 0)) {
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
        <GamePage gameState={gameState} setGameState={setGameState} />
      )}
    </div>
  )
}

export default App
