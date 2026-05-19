import FishGraph from '../components/FishGraph'
import { useState } from 'react'
import {
    GAME_CONFIG, berechneFischbestand, berechneNetWorth,
    kiBootAktionLeicht, kiAusgesandtLeicht,
    kiBootAktionSchwer, kiAusgesandtSchwer,
    erzeugeMarktereignis,
} from '../game/fishLogic'

function fischDichte(bestand) { return bestand / GAME_CONFIG.maxFischbestand }

const PERSOENLICHKEIT_LABEL = {
    gierig:     { label: '🔴 Gierig',     },
    kooperativ: { label: '🤝 Kooperativ', },
    rational:   { label: '🧠 Rational',   },
}

const DIFF_BADGE = {
    leicht: { icon: '🟢', label: 'Leicht', bg: 'bg-green-500/25', text: 'text-green-300' },
    schwer: { icon: '🔴', label: 'Schwer', bg: 'bg-red-500/25',   text: 'text-red-300'   },
}

// Supply/demand price adjustment: too many boats → price falls, too few → price rises.
function aktualisiereMarktpreis(aktuellPreis, alleTeams) {
    const totalBoote = alleTeams.reduce((sum, t) => sum + t.boote, 0)
    let neuerPreis = aktuellPreis
    if (totalBoote > 15) neuerPreis *= 0.95
    else if (totalBoote < 9) neuerPreis *= 1.05
    return Math.max(150, Math.min(1000, Math.round(neuerPreis / 10) * 10))
}

// Maximum bid a KI team is willing to pay per boat.
function kiMaxGebot(team, fischbestand, marketShipPrice) {
    let maxBid
    if (team.persoenlichkeit === 'gierig') maxBid = fischbestand > 3000 ? 800 : 300
    else if (team.persoenlichkeit === 'kooperativ') maxBid = 400
    else maxBid = Math.round(marketShipPrice * 1.1)  // rational
    return Math.min(maxBid, team.guthaben)
}

// Each offered boat goes to the KI team with the highest bid (≥ 150).
function loeseAuktion(teams, anzahlAngebote, fischbestand, marketShipPrice) {
    if (anzahlAngebote === 0) return { teams, auctionEvents: [] }
    let aktuelleTeams = teams.map(t => ({ ...t }))
    const auctionEvents = []
    for (let i = 0; i < anzahlAngebote; i++) {
        if (aktuelleTeams[0].boote <= 1) break
        let bestBid = 149  // minimum accepted bid is 150
        let bestBidderIdx = -1
        aktuelleTeams.forEach((team, idx) => {
            if (idx === 0 || !team.istKI) return
            const gebot = kiMaxGebot(team, fischbestand, marketShipPrice)
            if (gebot > bestBid) { bestBid = gebot; bestBidderIdx = idx }
        })
        if (bestBidderIdx === -1) {
            auctionEvents.push({ erfolg: false })
        } else {
            aktuelleTeams[0] = { ...aktuelleTeams[0], boote: aktuelleTeams[0].boote - 1, guthaben: aktuelleTeams[0].guthaben + bestBid }
            aktuelleTeams[bestBidderIdx] = { ...aktuelleTeams[bestBidderIdx], boote: aktuelleTeams[bestBidderIdx].boote + 1, guthaben: aktuelleTeams[bestBidderIdx].guthaben - bestBid }
            auctionEvents.push({ erfolg: true, kaeufer: aktuelleTeams[bestBidderIdx].name, preis: bestBid })
        }
    }
    return { teams: aktuelleTeams, auctionEvents }
}

function kiTeamAktionen(team, fischbestand, verlauf, alleTeams, schwierigkeit, marketShipPrice) {
    let booteResult
    if (schwierigkeit === 'schwer') {
        booteResult = kiBootAktionSchwer(team, fischbestand, verlauf, alleTeams, marketShipPrice)
        return {
            ...booteResult,
            ausgesandteBoote: kiAusgesandtSchwer(
                team.persoenlichkeit, team.name, booteResult.boote,
                fischbestand, verlauf, alleTeams
            ),
        }
    }
    booteResult = kiBootAktionLeicht(team, marketShipPrice)
    return { ...booteResult, ausgesandteBoote: kiAusgesandtLeicht(booteResult.boote) }
}

function simuliereRunde(state, spielerBoote, spielerBooteAngeboten, schwierigkeit) {
    const marketShipPrice = state.marketShipPrice || GAME_CONFIG.auctionPreis

    // KI decisions (buy/sell boats + boats to fish)
    const neueTeams = state.teams.map((team, index) => {
        if (index === 0) return { ...team, ausgesandteBoote: spielerBoote }
        const aktionen = kiTeamAktionen(team, state.fischbestand, state.verlauf, state.teams, schwierigkeit, marketShipPrice)
        return { ...team, ...aktionen }
    })

    const marktereignis = erzeugeMarktereignis()

    // Proportional catch: shared pool split by fleet share ±15%
    const gesamteBoote = neueTeams.reduce((sum, t) => sum + t.ausgesandteBoote, 0)
    const dichte = state.fischbestand / GAME_CONFIG.maxFischbestand
    const eff = 25 * Math.sqrt(Math.max(0, dichte))
    const gesamtFang = gesamteBoote > 0 ? Math.round(Math.min(gesamteBoote * eff, state.fischbestand)) : 0
    const wachstum = Math.round(GAME_CONFIG.wachstumsRate * state.fischbestand * (1 - state.fischbestand / GAME_CONFIG.maxFischbestand))
    const neuerFischbestand = berechneFischbestand(state.fischbestand, gesamtFang)

    console.log('Catch:', gesamtFang, 'Growth:', wachstum, 'Net:', wachstum - gesamtFang)
    if (import.meta.env.DEV) {
        console.log(`[Runde ${state.runde}] Markt: ${marktereignis.toFixed(3)}, Boote: [${neueTeams.map(t => t.ausgesandteBoote).join(', ')}], Fisch: ${state.fischbestand}→${neuerFischbestand}, Fang: ${gesamtFang}`)
    }

    // Economics: operating costs → revenue → interest
    let teamsNachRunde = neueTeams.map((team) => {
        const anteil = gesamteBoote > 0 ? team.ausgesandteBoote / gesamteBoote : 0
        const varianz = 0.85 + Math.random() * 0.30
        const fang = Math.round(gesamtFang * anteil * varianz)
        const betriebskosten = team.ausgesandteBoote * GAME_CONFIG.betriebskosten
        const balanceNachBetrieb = team.guthaben - betriebskosten
        const einnahmen = Math.round(fang * GAME_CONFIG.fischPreis * marktereignis)
        const zinsen = Math.round(balanceNachBetrieb * GAME_CONFIG.zinsRate)
        const neuesGuthaben = balanceNachBetrieb + einnahmen + zinsen
        const netWorth = berechneNetWorth(neuesGuthaben, team.boote, marketShipPrice)
        return { ...team, letzterFang: fang, letzteZinsen: zinsen, guthaben: neuesGuthaben, netWorth }
    })

    // Auction: player offers boats, KI teams auto-bid
    const booteZuAnbieten = Math.min(spielerBooteAngeboten, Math.max(0, teamsNachRunde[0].boote - 1))
    const { teams: teamsNachAuktion, auctionEvents } = loeseAuktion(teamsNachRunde, booteZuAnbieten, neuerFischbestand, marketShipPrice)

    // Update market price after fleet changes, then recompute Net Worth
    const neuerMarktpreis = aktualisiereMarktpreis(marketShipPrice, teamsNachAuktion)
    const finalTeams = teamsNachAuktion.map(team => ({
        ...team,
        netWorth: berechneNetWorth(team.guthaben, team.boote, neuerMarktpreis)
    }))

    const verlaufEintrag = { runde: state.runde, fischbestand: state.fischbestand, gesamtFang, preisMultiplikator: marktereignis }
    finalTeams.forEach(team => { verlaufEintrag[team.name] = team.netWorth })

    const neueAuctionHistory = auctionEvents.some(e => e.erfolg)
        ? [...(state.auctionHistory || []), ...auctionEvents.filter(e => e.erfolg).map(e => ({ runde: state.runde, ...e }))]
        : (state.auctionHistory || [])

    return {
        ...state,
        runde: state.runde + 1,
        fischbestand: neuerFischbestand,
        marketShipPrice: neuerMarktpreis,
        teams: finalTeams,
        verlauf: [...state.verlauf, verlaufEintrag],
        auctionHistory: neueAuctionHistory,
        letzteAuktionEvents: auctionEvents,
    }
}

function GamePage({ gameState, setGameState }) {
    const spielerTeam = gameState.teams[0]
    const [ausgesandt, setAusgesandt] = useState(1)
    const [boatsOffered, setBoatsOffered] = useState(0)
    const [rundenErgebnis, setRundenErgebnis] = useState(null)
    const maxRunden = gameState.maxRunden || GAME_CONFIG.maxRunden
    const schwierigkeit = gameState.schwierigkeitsgrad || 'leicht'
    const diffBadge = DIFF_BADGE[schwierigkeit] || DIFF_BADGE.leicht
    const marketShipPrice = gameState.marketShipPrice || GAME_CONFIG.auctionPreis

    function handleBootKaufen() {
        if (spielerTeam.guthaben < GAME_CONFIG.bootKosten) return
        setGameState({
            ...gameState,
            teams: gameState.teams.map((team, index) => {
                if (index !== 0) return team
                const neuesGuthaben = team.guthaben - GAME_CONFIG.bootKosten
                const neueBoote = team.boote + 1
                return { ...team, boote: neueBoote, guthaben: neuesGuthaben, netWorth: berechneNetWorth(neuesGuthaben, neueBoote, marketShipPrice) }
            })
        })
    }

    function handleBootVerkaufen() {
        if (spielerTeam.boote <= 1) return
        setGameState({
            ...gameState,
            teams: gameState.teams.map((team, index) => {
                if (index !== 0) return team
                const neuesGuthaben = team.guthaben + marketShipPrice
                const neueBoote = team.boote - 1
                return { ...team, boote: neueBoote, guthaben: neuesGuthaben, netWorth: berechneNetWorth(neuesGuthaben, neueBoote, marketShipPrice) }
            })
        })
    }

    function handleRunde() {
        const nachRunde = simuliereRunde(gameState, ausgesandt, boatsOffered, schwierigkeit)
        const fischDelta = nachRunde.fischbestand - gameState.fischbestand

        setRundenErgebnis({
            runde: gameState.runde,
            teams: nachRunde.teams,
            fischDelta,
            neuerFischbestand: nachRunde.fischbestand,
            auctionEvents: nachRunde.letzteAuktionEvents || [],
            gameStateNachRunde: {
                ...nachRunde,
                phase: gameState.runde >= maxRunden ? 'ende' : 'entscheidung'
            }
        })

        setAusgesandt(1)
        setBoatsOffered(0)
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
            state = simuliereRunde(state, Math.max(1, Math.floor(state.teams[0].boote * 0.6)), 0, schwierigkeit)
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

                        {rundenErgebnis.auctionEvents.length > 0 && (
                            <div className="bg-yellow-500/10 border border-yellow-400/20 rounded-xl p-3 mb-4">
                                <div className="font-bold text-xs text-yellow-300 mb-1.5">🔨 Auktionsergebnis</div>
                                {rundenErgebnis.auctionEvents.map((ev, i) => (
                                    <div key={i} className="text-xs text-blue-200">
                                        {ev.erfolg
                                            ? `✅ 1 Boot → ${ev.kaeufer} für ${ev.preis.toLocaleString()}€`
                                            : '❌ Kein Gebot – Boot nicht verkauft'}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className={`rounded-xl p-3 mb-4 text-center font-bold ${rundenErgebnis.fischDelta < 0 ? 'bg-red-500/20 text-red-200' : 'bg-green-500/20 text-green-200'}`}>
                            {rundenErgebnis.fischDelta < 0 ? '📉' : '📈'} Fischbestand: {rundenErgebnis.fischDelta > 0 ? '+' : ''}{rundenErgebnis.fischDelta.toLocaleString()} Fisch → jetzt {rundenErgebnis.neuerFischbestand.toLocaleString()} / {GAME_CONFIG.maxFischbestand.toLocaleString()}
                        </div>

                        {rundenErgebnis.neuerFischbestand < GAME_CONFIG.maxFischbestand * 0.40 && (
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
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-yellow-500/20 text-yellow-300">
                        🚢 Marktpreis: {marketShipPrice.toLocaleString()}€
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

                    {(() => {
                        const dichte = fischDichte(gameState.fischbestand)
                        const pct = Math.round(dichte * 100)
                        return (
                            <div className={`flex-none bg-white/10 rounded-xl px-4 py-3 ${dichte <= 0.30 ? 'pulse-critical' : ''}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold">🌊 Fischbestand</span>
                                    <span className="font-bold text-lg">{gameState.fischbestand.toLocaleString()} / {GAME_CONFIG.maxFischbestand.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden mb-1">
                                    <div
                                        className="h-3 rounded-full fish-bar-transition"
                                        style={{
                                            width: `${pct}%`,
                                            backgroundColor: dichte > 0.60 ? '#22c55e' : dichte > 0.30 ? '#f59e0b' : '#ef4444'
                                        }}
                                    />
                                </div>
                                <div className="flex justify-between text-sm text-blue-200">
                                    <span>{dichte > 0.60 ? '✅ Gesund' : dichte > 0.30 ? '⚠️ Gefährdet' : '🚨 Kritisch!'}</span>
                                </div>
                            </div>
                        )
                    })()}

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
                                    <div className="text-xs text-blue-200 mt-1">💰 {team.guthaben.toLocaleString()}€</div>
                                    <div className="text-xs text-blue-200">🚢 {(team.boote * marketShipPrice).toLocaleString()}€ ({team.boote} Boote)</div>
                                    <div className="text-sm font-bold mt-0.5">📊 {team.netWorth.toLocaleString()}€</div>
                                    {team.letzterFang > 0 && (
                                        <div className="text-xs">🐟 {team.letzterFang} Fisch | 🏦 {team.letzteZinsen >= 0 ? '+' : ''}{team.letzteZinsen}€</div>
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

                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <button
                                    onClick={handleBootKaufen}
                                    disabled={spielerTeam.guthaben < GAME_CONFIG.bootKosten}
                                    className="bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed font-bold py-3 rounded-xl transition-colors text-sm"
                                >
                                    🚢 Boot kaufen<br />
                                    <span className="font-normal">{GAME_CONFIG.bootKosten.toLocaleString()}€ (Werft)</span>
                                </button>
                                <button
                                    onClick={handleBootVerkaufen}
                                    disabled={spielerTeam.boote <= 1}
                                    className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed font-bold py-3 rounded-xl transition-colors text-sm"
                                >
                                    💸 Boot verkaufen<br />
                                    <span className="font-normal">{marketShipPrice.toLocaleString()}€ (sofort)</span>
                                </button>
                            </div>

                            {/* Auction offer */}
                            {spielerTeam.boote > 1 && (
                                <div className="bg-yellow-500/10 border border-yellow-400/20 rounded-xl px-3 py-2 mb-3">
                                    <div className="text-xs text-yellow-300 font-bold mb-1.5">🔨 Boote zur Auktion anbieten</div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setBoatsOffered(Math.max(0, boatsOffered - 1))}
                                            className="bg-white/20 hover:bg-white/30 w-7 h-7 rounded-full font-bold text-sm flex items-center justify-center shrink-0"
                                        >−</button>
                                        <div className="text-xl font-bold w-8 text-center">{boatsOffered}</div>
                                        <button
                                            onClick={() => setBoatsOffered(Math.min(spielerTeam.boote - 1, boatsOffered + 1))}
                                            className="bg-white/20 hover:bg-white/30 w-7 h-7 rounded-full font-bold text-sm flex items-center justify-center shrink-0"
                                        >+</button>
                                        <div className="text-xs text-blue-300">mind. 150€ Startgebot</div>
                                    </div>
                                </div>
                            )}
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
