import FishGraph from '../components/FishGraph'
import { useState } from 'react'
import { GAME_CONFIG, berechneFischbestand, berechneFang, berechneGewinn } from '../game/fishLogic'

const PERSOENLICHKEIT_LABEL = {
    gierig:     { label: '🔴 Gierig',     beschreibung: 'Fischt maximal, kauft aggressiv' },
    kooperativ: { label: '🤝 Kooperativ', beschreibung: 'Fischt nachhaltig, schützt Bestand' },
    rational:   { label: '🧠 Rational',   beschreibung: 'Nash-Gleichgewicht, ROI-optimiert' },
}

function kiEntscheidungGierig(boote) {
    return boote // immer maximale Kapazität
}

function kiEntscheidungKooperativ(fischbestand, boote) {
    if (fischbestand > 60) return Math.floor(boote * 0.55)
    if (fischbestand > 40) return Math.floor(boote * 0.45)
    return Math.floor(boote * 0.3) // stark reduzieren bei kritischem Bestand
}

function kiEntscheidungRational(fischbestand, boote, gesamteBooteVorherigeRunde) {
    // Nash-Gleichgewicht: Jedes Team maximiert Gewinn gegeben der anderen Strategien
    // Optimaler Fang sinkt wenn Bestand sinkt (rationaler Anreiz)
    if (fischbestand > 70) return Math.floor(boote * 0.75)
    if (fischbestand > 50) return Math.floor(boote * 0.6)
    if (fischbestand > 30) return Math.floor(boote * 0.45)
    return Math.floor(boote * 0.35) // rationaler Rückzug bei geringem Bestand
}

function kiBootAktion(team, fischbestand) {
    let boote = team.boote
    let guthaben = team.guthaben

    if (team.persoenlichkeit === 'gierig') {
        // Kauft aggressiv wenn Bestand > 50%, verkauft nie
        if (fischbestand > 50 && guthaben >= GAME_CONFIG.bootKosten) {
            boote += 1
            guthaben -= GAME_CONFIG.bootKosten
        }
    } else if (team.persoenlichkeit === 'kooperativ') {
        // Verkauft Boote wenn Bestand kritisch
        if (fischbestand < 25 && boote > 2) {
            boote -= 1
            guthaben += GAME_CONFIG.bootVerkaufswert
        }
        // Kauft selten – nur wenn Bestand sehr gesund
        if (fischbestand > 75 && guthaben >= GAME_CONFIG.bootKosten && boote < 6) {
            boote += 1
            guthaben -= GAME_CONFIG.bootKosten
        }
    } else if (team.persoenlichkeit === 'rational') {
        // ROI-Kalkulation: Boot lohnt sich wenn erwarteter Zusatzertrag > Kosten
        // Erwarteter Zusatzfang pro Boot ≈ fischbestand / 20 Fisch → × fischPreis - bootBetriebskosten
        const erwarteterZusatzGewinn = (fischbestand / 20) * GAME_CONFIG.fischPreis - 500
        if (erwarteterZusatzGewinn > 0 && guthaben >= GAME_CONFIG.bootKosten && fischbestand > 40) {
            boote += 1
            guthaben -= GAME_CONFIG.bootKosten
        } else if (fischbestand < 30 && boote > 3) {
            boote -= 1
            guthaben += GAME_CONFIG.bootVerkaufswert
        }
    }

    return { boote, guthaben }
}

function GamePage({ gameState, setGameState }) {
    const spielerTeam = gameState.teams[0]
    const [ausgesandt, setAusgesandt] = useState(1)
    const [rundenErgebnis, setRundenErgebnis] = useState(null)
    const maxRunden = gameState.maxRunden || GAME_CONFIG.maxRunden

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
        const neueTeams = gameState.teams.map((team, index) => {
            if (index === 0) return { ...team, ausgesandteBoote: ausgesandt }

            const { boote: kiBoote, guthaben: kiGuthaben } = kiBootAktion(team, gameState.fischbestand)

            let kiAusgesandt
            if (team.persoenlichkeit === 'gierig') {
                kiAusgesandt = kiEntscheidungGierig(kiBoote)
            } else if (team.persoenlichkeit === 'kooperativ') {
                kiAusgesandt = kiEntscheidungKooperativ(gameState.fischbestand, kiBoote)
            } else {
                kiAusgesandt = kiEntscheidungRational(gameState.fischbestand, kiBoote)
            }

            return { ...team, boote: kiBoote, guthaben: kiGuthaben, ausgesandteBoote: kiAusgesandt }
        })

        const gesamteBoote = neueTeams.reduce((sum, t) => sum + t.ausgesandteBoote, 0)
        const neuerFischbestand = berechneFischbestand(gameState.fischbestand, gesamteBoote)

        const teamsNachRunde = neueTeams.map(team => {
            const fang = berechneFang(team.ausgesandteBoote, gameState.fischbestand, gesamteBoote)
            const gewinn = berechneGewinn(fang, team.ausgesandteBoote)
            return { ...team, letzterFang: fang, guthaben: team.guthaben + gewinn }
        })

        const verlaufEintrag = { runde: gameState.runde, fischbestand: gameState.fischbestand, gesamteBoote }
        teamsNachRunde.forEach(team => { verlaufEintrag[team.name] = team.guthaben })
        const neuerVerlauf = [...gameState.verlauf, verlaufEintrag]

        const fischDelta = neuerFischbestand - gameState.fischbestand

        setRundenErgebnis({
            runde: gameState.runde,
            teams: teamsNachRunde,
            fischDelta,
            neuerFischbestand,
            gameStateNachRunde: {
                ...gameState,
                runde: gameState.runde + 1,
                fischbestand: neuerFischbestand,
                teams: teamsNachRunde,
                verlauf: neuerVerlauf,
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
            const neueTeams = state.teams.map((team, index) => {
                if (index === 0) return { ...team, ausgesandteBoote: Math.floor(team.boote * 0.6) }
                const { boote: kiBoote, guthaben: kiGuthaben } = kiBootAktion(team, state.fischbestand)
                let kiAusgesandt
                if (team.persoenlichkeit === 'gierig') kiAusgesandt = kiEntscheidungGierig(kiBoote)
                else if (team.persoenlichkeit === 'kooperativ') kiAusgesandt = kiEntscheidungKooperativ(state.fischbestand, kiBoote)
                else kiAusgesandt = kiEntscheidungRational(state.fischbestand, kiBoote)
                return { ...team, boote: kiBoote, guthaben: kiGuthaben, ausgesandteBoote: kiAusgesandt }
            })

            const gesamteBoote = neueTeams.reduce((sum, t) => sum + t.ausgesandteBoote, 0)
            const neuerFischbestand = berechneFischbestand(state.fischbestand, gesamteBoote)

            const teamsNachRunde = neueTeams.map(team => {
                const fang = berechneFang(team.ausgesandteBoote, state.fischbestand, gesamteBoote)
                const gewinn = berechneGewinn(fang, team.ausgesandteBoote)
                return { ...team, letzterFang: fang, guthaben: team.guthaben + gewinn }
            })

            const verlaufEintrag = { runde: state.runde, fischbestand: state.fischbestand, gesamteBoote }
            teamsNachRunde.forEach(team => { verlaufEintrag[team.name] = team.guthaben })

            state = {
                ...state,
                runde: state.runde + 1,
                fischbestand: neuerFischbestand,
                teams: teamsNachRunde,
                verlauf: [...state.verlauf, verlaufEintrag],
            }
        }

        setGameState({ ...state, phase: 'ende' })
    }

    return (
        <div className="min-h-screen bg-blue-900 p-4 sm:p-6">

            {/* Rundenüberlagerung */}
            {rundenErgebnis && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-blue-900 border border-blue-600 rounded-2xl p-6 max-w-md w-full text-white shadow-2xl">
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
            <div className="flex justify-between items-center mb-6 text-white">
                <h1 className="text-xl sm:text-2xl font-bold">🐟 Fish Banks Game</h1>
                <div className="text-right">
                    <div className="text-sm text-blue-200">Runde</div>
                    <div className="text-2xl font-bold">{gameState.runde} / {maxRunden}</div>
                </div>
            </div>

            {/* Fischbestand */}
            <div className={`bg-white/10 rounded-2xl p-6 mb-6 text-white ${gameState.fischbestand <= 30 ? 'pulse-critical' : ''}`}>
                <div className="flex justify-between mb-2">
                    <span className="font-bold">🌊 Fischbestand</span>
                    <span className="font-bold">{gameState.fischbestand}%</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-4 overflow-hidden">
                    <div
                        className="h-4 rounded-full fish-bar-transition"
                        style={{
                            width: `${gameState.fischbestand}%`,
                            backgroundColor: gameState.fischbestand > 60 ? '#22c55e' : gameState.fischbestand > 30 ? '#f59e0b' : '#ef4444'
                        }}
                    />
                </div>
                <div className="text-sm text-blue-200 mt-2">
                    {gameState.fischbestand > 60 ? '✅ Gesund' : gameState.fischbestand > 30 ? '⚠️ Gefährdet' : '🚨 Kritisch!'}
                </div>
            </div>

            <FishGraph verlauf={gameState.verlauf} />

            {/* Teams Übersicht */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                {gameState.teams.map((team, index) => {
                    const persLabel = team.persoenlichkeit ? PERSOENLICHKEIT_LABEL[team.persoenlichkeit] : null
                    return (
                        <div key={team.name} className={`rounded-xl p-4 text-white ${index === 0 ? 'bg-green-600/80' : 'bg-white/10'}`}>
                            <div className="flex justify-between items-start">
                                <span className="font-bold text-sm sm:text-base">{team.farbe} {team.name}</span>
                                <span className="text-xs">{index === 0 ? '👤 Du' : '🤖'}</span>
                            </div>
                            {persLabel && (
                                <div className="text-xs text-blue-300 mt-0.5 mb-1">{persLabel.label}</div>
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

            {/* Spieler Entscheidung */}
            <div className="bg-white/10 rounded-2xl p-6 text-white">
                <h2 className="font-bold text-lg mb-1">🎮 Deine Entscheidung – {spielerTeam.name}</h2>
                <p className="text-blue-200 text-sm mb-4">Wie viele Boote sendest du aus? (max. {spielerTeam.boote})</p>
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setAusgesandt(Math.max(0, ausgesandt - 1))}
                        className="bg-white/20 hover:bg-white/30 w-10 h-10 rounded-full text-xl font-bold flex items-center justify-center">−</button>
                    <div className="text-4xl font-bold w-16 text-center">{ausgesandt}</div>
                    <button onClick={() => setAusgesandt(Math.min(spielerTeam.boote, ausgesandt + 1))}
                        className="bg-white/20 hover:bg-white/30 w-10 h-10 rounded-full text-xl font-bold flex items-center justify-center">+</button>
                    <div className="text-blue-200 text-sm">🚢 von {spielerTeam.boote} Booten</div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                    <button onClick={handleBootKaufen}
                        disabled={spielerTeam.guthaben < GAME_CONFIG.bootKosten}
                        className="bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed font-bold py-3 rounded-xl transition-colors">
                        🚢 Boot kaufen<br />
                        <span className="text-sm font-normal">5.000€</span>
                    </button>
                    <button onClick={handleBootVerkaufen}
                        disabled={spielerTeam.boote <= 1}
                        className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed font-bold py-3 rounded-xl transition-colors">
                        💸 Boot verkaufen<br />
                        <span className="text-sm font-normal">3.000€</span>
                    </button>
                </div>

                {import.meta.env.DEV && (
                    <button onClick={handleDevSkip}
                        className="w-full bg-purple-600 hover:bg-purple-500 font-bold py-2 rounded-xl mb-3 transition-colors text-sm">
                        ⚡ DEV: Spiel simulieren
                    </button>
                )}

                <button onClick={handleRunde}
                    className="w-full bg-green-500 hover:bg-green-400 font-bold py-4 rounded-xl text-xl transition-colors">
                    ✅ Runde bestätigen
                </button>
            </div>

        </div>
    )
}

export default GamePage
