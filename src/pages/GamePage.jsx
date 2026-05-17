import FishGraph from '../components/FishGraph'
import { useState } from 'react'
import {
    GAME_CONFIG, berechneFischbestand, berechneFang, berechneGewinn,
    kiBootAktionLeicht, kiAusgesandtLeicht,
    kiBootAktionMittel, kiAusgesandtMittel,
    kiBootAktionSchwer, kiAusgesandtSchwer,
    erzeugeMarktereignis,
} from '../game/fishLogic'

const PERSOENLICHKEIT_LABEL = {
    gierig:     { label: '🔴 Gierig',     },
    kooperativ: { label: '🤝 Kooperativ', },
    rational:   { label: '🧠 Rational',   },
}

const DIFF_BADGE = {
    leicht: { icon: '🟢', label: 'Leicht', bg: 'bg-green-500/25', text: 'text-green-300' },
    mittel: { icon: '🟡', label: 'Mittel', bg: 'bg-yellow-500/25', text: 'text-yellow-300' },
    schwer: { icon: '🔴', label: 'Schwer', bg: 'bg-red-500/25',   text: 'text-red-300'   },
}

function kiTeamAktionen(team, fischbestand, verlauf, alleTeams, schwierigkeit) {
    let booteResult

    if (schwierigkeit === 'leicht') {
        booteResult = kiBootAktionLeicht(team)
        return { ...booteResult, ausgesandteBoote: kiAusgesandtLeicht(booteResult.boote) }
    }
    if (schwierigkeit === 'schwer') {
        booteResult = kiBootAktionSchwer(team, fischbestand, verlauf, alleTeams)
        return {
            ...booteResult,
            ausgesandteBoote: kiAusgesandtSchwer(
                team.persoenlichkeit, team.name, booteResult.boote,
                fischbestand, verlauf, alleTeams
            ),
        }
    }
    booteResult = kiBootAktionMittel(team, fischbestand)
    return {
        ...booteResult,
        ausgesandteBoote: kiAusgesandtMittel(team.persoenlichkeit, fischbestand, booteResult.boote),
    }
}

function simuliereRunde(state, spielerBoote, schwierigkeit) {
    const neueTeams = state.teams.map((team, index) => {
        if (index === 0) return { ...team, ausgesandteBoote: spielerBoote }
        const aktionen = kiTeamAktionen(
            team, state.fischbestand, state.verlauf, state.teams, schwierigkeit
        )
        return { ...team, ...aktionen }
    })

    const gesamteBoote = neueTeams.reduce((sum, t) => sum + t.ausgesandteBoote, 0)
    const neuerFischbestand = berechneFischbestand(state.fischbestand, gesamteBoote)
    const marktereignis = erzeugeMarktereignis()

    if (import.meta.env.DEV) {
        console.log(`[Runde ${state.runde}] Markt: ${marktereignis.toFixed(3)}, Boote: [${neueTeams.map(t => t.ausgesandteBoote).join(', ')}], Bestand: ${state.fischbestand} → ${neuerFischbestand}`)
    }

    const teamsNachRunde = neueTeams.map(team => {
        const fang = berechneFang(team.ausgesandteBoote, state.fischbestand, gesamteBoote)
        const gewinn = berechneGewinn(fang, team.ausgesandteBoote, marktereignis)
        return { ...team, letzterFang: fang, guthaben: team.guthaben + gewinn }
    })

    const verlaufEintrag = { runde: state.runde, fischbestand: state.fischbestand, gesamteBoote, preisMultiplikator: marktereignis }
    teamsNachRunde.forEach(team => { verlaufEintrag[team.name] = team.guthaben })

    return {
        ...state,
        runde: state.runde + 1,
        fischbestand: neuerFischbestand,
        teams: teamsNachRunde,
        verlauf: [...state.verlauf, verlaufEintrag],
    }
}

function GamePage({ gameState, setGameState }) {
    const spielerTeam = gameState.teams[0]
    const [ausgesandt, setAusgesandt] = useState(1)
    const [rundenErgebnis, setRundenErgebnis] = useState(null)
    const maxRunden = gameState.maxRunden || GAME_CONFIG.maxRunden
    const schwierigkeit = gameState.schwierigkeitsgrad || 'mittel'
    const diffBadge = DIFF_BADGE[schwierigkeit] || DIFF_BADGE.mittel

    function handleBootKaufen() {
        if (spielerTeam.guthaben < GAME_CONFIG.bootKosten) return
        setGameState({
            ...gameState,
            teams: gameState.teams.map((team, index) =>
                index === 0
                    ? { ...team, boote: team.boote + 1, guthaben: team.guthaben - GAME_CONFIG.bootKosten }
                    : team
            )
        })
    }

    function handleBootVerkaufen() {
        if (spielerTeam.boote <= 1) return
        setGameState({
            ...gameState,
            teams: gameState.teams.map((team, index) =>
                index === 0
                    ? { ...team, boote: team.boote - 1, guthaben: team.guthaben + GAME_CONFIG.bootVerkaufswert }
                    : team
            )
        })
    }

    function handleRunde() {
        const nachRunde = simuliereRunde(gameState, ausgesandt, schwierigkeit)
        const fischDelta = nachRunde.fischbestand - gameState.fischbestand

        setRundenErgebnis({
            runde: gameState.runde,
            teams: nachRunde.teams,
            fischDelta,
            neuerFischbestand: nachRunde.fischbestand,
            gameStateNachRunde: {
                ...nachRunde,
                phase: gameState.runde >= maxRunden ? 'ende' : 'entscheidung'
            }
        })

        setAusgesandt(1)
    }

    function handleWeiter() {
        if (!rundenErgebnis) return
        setGameState(rundenErgebnis.gameStateNachRunde)
        setRundenErgebnis(null)
    }

    function handleDevSkip() {
        let state = {
            ...gameState,
            verlauf: [...gameState.verlauf],
            teams: gameState.teams.map(t => ({ ...t }))
        }

        while (state.runde <= maxRunden && state.fischbestand > 0) {
            state = simuliereRunde(state, Math.max(1, Math.floor(state.teams[0].boote * 0.6)), schwierigkeit)
        }

        setGameState({ ...state, phase: 'ende' })
    }

    return (
        <div className="w-full h-full bg-blue-900 text-white flex flex-col overflow-hidden">

            {/* Round result modal */}
            {rundenErgebnis && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-blue-900 border border-blue-600 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <h2 className="text-xl font-bold mb-1 text-center">📋 Runde {rundenErgebnis.runde} – Ergebnis</h2>
                        <p className="text-blue-300 text-sm text-center mb-4">Was ist diese Runde passiert?</p>

                        <div className="space-y-2 mb-4">
                            {rundenErgebnis.teams.map(team => (
                                <div key={team.name} className="flex justify-between items-center bg-white/10 rounded-xl px-3 py-2 text-sm">
                                    <span>{team.farbe} {team.name}</span>
                                    <span>🐟 {team.letzterFang} Fisch gefangen</span>
                                </div>
                            ))}
                        </div>

                        <div className={`rounded-xl p-3 mb-4 text-center font-bold ${rundenErgebnis.fischDelta < 0 ? 'bg-red-500/20 text-red-200' : 'bg-green-500/20 text-green-200'}`}>
                            {rundenErgebnis.fischDelta < 0 ? '📉' : '📈'} Fischbestand: {rundenErgebnis.fischDelta > 0 ? '+' : ''}{rundenErgebnis.fischDelta}% → jetzt {rundenErgebnis.neuerFischbestand}%
                        </div>

                        {rundenErgebnis.neuerFischbestand < 40 && (
                            <div className="bg-orange-500/20 border border-orange-400/40 rounded-xl p-3 mb-4 text-sm text-orange-200 text-center">
                                ⚠️ <strong>Warnung:</strong> Fischbestand unter 40%! Nachhaltige Bewirtschaftung gefährdet.
                            </div>
                        )}

                        <button
                            onClick={handleWeiter}
                            className="w-full bg-green-500 hover:bg-green-400 font-bold py-3 rounded-xl transition-colors text-lg"
                        >
                            Nächste Runde →
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex-none flex justify-between items-center px-6 py-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold">🐟 Fish Banks Game</h1>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${diffBadge.bg} ${diffBadge.text}`}>
                        {diffBadge.icon} {diffBadge.label}
                    </span>
                </div>
                <div className="text-right">
                    <div className="text-xs text-blue-200">Runde</div>
                    <div className="text-2xl font-bold leading-none">{gameState.runde} / {maxRunden}</div>
                </div>
            </div>

            {/* Main two-column layout */}
            <div className="flex-1 min-h-0 grid grid-cols-2 gap-4 p-4">

                {/* Left column: fish stock + graph */}
                <div className="flex flex-col gap-3 min-h-0">

                    <div className={`flex-none bg-white/10 rounded-xl px-4 py-3 ${gameState.fischbestand <= 30 ? 'pulse-critical' : ''}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold">🌊 Fischbestand</span>
                            <span className="font-bold text-lg">{gameState.fischbestand}%</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                            <div
                                className="h-3 rounded-full fish-bar-transition"
                                style={{
                                    width: `${gameState.fischbestand}%`,
                                    backgroundColor: gameState.fischbestand > 60 ? '#22c55e' : gameState.fischbestand > 30 ? '#f59e0b' : '#ef4444'
                                }}
                            />
                        </div>
                        <div className="text-sm text-blue-200 mt-1">
                            {gameState.fischbestand > 60 ? '✅ Gesund' : gameState.fischbestand > 30 ? '⚠️ Gefährdet' : '🚨 Kritisch!'}
                        </div>
                    </div>

                    {/* Graph fills remaining height */}
                    <div className="flex-1 min-h-0">
                        <FishGraph verlauf={gameState.verlauf} />
                    </div>
                </div>

                {/* Right column: teams + decision */}
                <div className="flex flex-col gap-3 min-h-0">

                    {/* Team cards — 2×2 grid */}
                    <div className="flex-none grid grid-cols-2 gap-3">
                        {gameState.teams.map((team, index) => {
                            const persLabel = team.persoenlichkeit ? PERSOENLICHKEIT_LABEL[team.persoenlichkeit] : null
                            return (
                                <div key={team.name} className={`rounded-xl px-4 py-3 ${index === 0 ? 'bg-green-600/80' : 'bg-white/10'}`}>
                                    <div className="flex justify-between items-start">
                                        <span className="font-bold text-sm">{team.farbe} {team.name}</span>
                                        <span className="text-xs opacity-70">{index === 0 ? '👤 Du' : '🤖'}</span>
                                    </div>
                                    {persLabel && (
                                        <div className="text-xs text-blue-300 mt-0.5">{persLabel.label}</div>
                                    )}
                                    <div className="text-sm mt-1">💰 {team.guthaben.toLocaleString()}€</div>
                                    <div className="text-sm">🚢 {team.boote} Boote</div>
                                    {team.letzterFang > 0 && (
                                        <div className="text-sm">🐟 {team.letzterFang} gefangen</div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Decision panel — fills remaining height */}
                    <div className="flex-1 min-h-0 bg-white/10 rounded-xl p-4 flex flex-col">
                        <div className="flex-none">
                            <h2 className="font-bold text-lg mb-0.5">🎮 Deine Entscheidung – {spielerTeam.name}</h2>
                            <p className="text-blue-200 text-sm mb-3">Wie viele Boote sendest du aus? (max. {spielerTeam.boote})</p>

                            <div className="flex items-center gap-4 mb-4">
                                <button
                                    onClick={() => setAusgesandt(Math.max(0, ausgesandt - 1))}
                                    className="bg-white/20 hover:bg-white/30 w-10 h-10 rounded-full text-xl font-bold flex items-center justify-center shrink-0"
                                >−</button>
                                <div className="text-4xl font-bold w-16 text-center">{ausgesandt}</div>
                                <button
                                    onClick={() => setAusgesandt(Math.min(spielerTeam.boote, ausgesandt + 1))}
                                    className="bg-white/20 hover:bg-white/30 w-10 h-10 rounded-full text-xl font-bold flex items-center justify-center shrink-0"
                                >+</button>
                                <div className="text-blue-200 text-sm">von {spielerTeam.boote} Booten</div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <button
                                    onClick={handleBootKaufen}
                                    disabled={spielerTeam.guthaben < GAME_CONFIG.bootKosten}
                                    className="bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed font-bold py-3 rounded-xl transition-colors text-sm"
                                >
                                    🚢 Boot kaufen<br />
                                    <span className="font-normal">5.000€</span>
                                </button>
                                <button
                                    onClick={handleBootVerkaufen}
                                    disabled={spielerTeam.boote <= 1}
                                    className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed font-bold py-3 rounded-xl transition-colors text-sm"
                                >
                                    💸 Boot verkaufen<br />
                                    <span className="font-normal">3.000€</span>
                                </button>
                            </div>
                        </div>

                        <div className="mt-auto">
                            {import.meta.env.DEV && (
                                <button
                                    onClick={handleDevSkip}
                                    className="w-full bg-purple-600 hover:bg-purple-500 font-bold py-2 rounded-xl mb-3 transition-colors text-sm"
                                >
                                    ⚡ DEV: Spiel simulieren
                                </button>
                            )}
                            <button
                                onClick={handleRunde}
                                className="w-full bg-green-500 hover:bg-green-400 font-bold py-4 rounded-xl text-xl transition-colors"
                            >
                                ✅ Runde bestätigen
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default GamePage
