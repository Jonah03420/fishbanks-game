import FishGraph from '../components/FishGraph'
import { useState } from 'react'
import {
    GAME_CONFIG, berechneFischbestand, berechneNetWorth,
    kiBootAktionLeicht, kiAusgesandtLeicht,
    kiBootAktionSchwer, kiAusgesandtSchwer,
    erzeugeMarktereignis,
} from '../game/fishLogic'

// ─── MIT Order Verification Test (DEV only) ───────────────────────────────────
// Scenario: team starts with $5000, buys 1 ship at auction ($500) → balance $4500, fleet 4
// Step 3: op costs  4 ships × $75 = $300  → balance $4200, min $4200
// Step 4: fish      50 fish × $20 = $1000 → balance $5200, min stays $4200
// Step 5: interest  $4200 × 2%   = $84   → balance $5284
// Step 6: orders    2 ships × $300 = $600  → balance $4684, shipsInDelivery = 2
// Next round: fleet = 4 + 2 = 6
if (import.meta.env.DEV) {
    ;(function verifyMITOrder() {
        const startBalance = 4500   // after buying 1 ship at auction ($5000 − $500)
        const fleet = 4             // 3 original + 1 bought at auction
        const deployed = 4
        const fang = 50
        const shipsOrdered = 2

        let balance = startBalance
        let minBalance = balance

        const opCosts = fleet * GAME_CONFIG.betriebskosten   // ALL ships
        balance -= opCosts
        minBalance = Math.min(minBalance, balance)

        const fishRevenue = fang * GAME_CONFIG.fischPreis    // no price multiplier in test
        balance += fishRevenue
        minBalance = Math.min(minBalance, balance)

        const zinsen = Math.round(minBalance * GAME_CONFIG.zinsRate)
        balance += zinsen

        const maxOrder = Math.ceil(fleet / 2)
        const actualOrder = Math.min(shipsOrdered, maxOrder)
        const orderCost = actualOrder * GAME_CONFIG.bootKosten
        balance -= orderCost

        const pass = opCosts === 300 && minBalance === 4200 && zinsen === 84 && balance === 4684 && actualOrder === 2
        console.log('[MIT Order Test]')
        console.log(`  Start balance (after auction buy): ${startBalance}€  ← $5000 − $500`)
        console.log(`  Op costs (${fleet} ships × ${GAME_CONFIG.betriebskosten}€): −${opCosts}€  → balance ${4500 - opCosts}€`)
        console.log(`  Fish revenue (${fang} × ${GAME_CONFIG.fischPreis}€): +${fishRevenue}€  → balance ${4500 - opCosts + fishRevenue}€`)
        console.log(`  Minimum balance: ${minBalance}€  (reached after op costs)`)
        console.log(`  Interest (${minBalance} × 2%): +${zinsen}€  → balance ${4500 - opCosts + fishRevenue + zinsen}€`)
        console.log(`  Ship orders (${actualOrder} × ${GAME_CONFIG.bootKosten}€): −${orderCost}€  → balance ${balance}€`)
        console.log(`  Max order (ceil(${fleet}/2)): ${maxOrder}  |  Actual order: ${actualOrder}`)
        console.log(`  Ships in delivery: ${actualOrder}  → fleet next round: ${fleet + actualOrder}`)
        console.log(`  ${pass ? 'PASS ✅' : 'FAIL ❌'}  expected: opCosts=300, minBalance=4200, interest=84, finalBalance=4684, fleet→6`)
    })()
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fischDichte(bestand) { return bestand / GAME_CONFIG.maxFischbestand }

const PERSOENLICHKEIT_LABEL = {
    gierig:     'Greedy',
    kooperativ: 'Cooperative',
    rational:   'Rational',
}

function aktualisiereMarktpreis(aktuellPreis, alleTeams) {
    const totalBoote = alleTeams.reduce((sum, t) => sum + t.boote, 0)
    let neuerPreis = aktuellPreis
    if (totalBoote > 15) neuerPreis *= 0.95
    else if (totalBoote < 9) neuerPreis *= 1.05
    return Math.max(150, Math.min(1000, Math.round(neuerPreis / 10) * 10))
}

function kiMaxGebot(team, fischbestand, marketShipPrice) {
    let maxBid
    if (team.persoenlichkeit === 'gierig') maxBid = fischbestand > 3000 ? 800 : 300
    else if (team.persoenlichkeit === 'kooperativ') maxBid = 400
    else maxBid = Math.round(marketShipPrice * 1.1)
    return Math.min(maxBid, team.guthaben)
}

function loeseAuktion(teams, sellerIdx, anzahlAngebote, fischbestand, marketShipPrice) {
    if (anzahlAngebote === 0) return { teams, auctionEvents: [] }
    let t = teams.map(x => ({ ...x }))
    const auctionEvents = []
    for (let i = 0; i < anzahlAngebote; i++) {
        if (t[sellerIdx].boote <= 1) break
        let bestBid = 149
        let bestBidderIdx = -1
        t.forEach((team, idx) => {
            if (idx === sellerIdx || !team.istKI) return
            const gebot = kiMaxGebot(team, fischbestand, marketShipPrice)
            if (gebot > bestBid) { bestBid = gebot; bestBidderIdx = idx }
        })
        if (bestBidderIdx === -1) {
            auctionEvents.push({ erfolg: false })
        } else {
            t[sellerIdx] = { ...t[sellerIdx], boote: t[sellerIdx].boote - 1, guthaben: t[sellerIdx].guthaben + bestBid }
            t[bestBidderIdx] = { ...t[bestBidderIdx], boote: t[bestBidderIdx].boote + 1, guthaben: t[bestBidderIdx].guthaben - bestBid }
            auctionEvents.push({ erfolg: true, kaeufer: t[bestBidderIdx].name, preis: bestBid })
        }
    }
    return { teams: t, auctionEvents }
}

function kiTeamAktionen(team, fischbestand, verlauf, alleTeams, schwierigkeit, marketShipPrice) {
    if (schwierigkeit === 'schwer') {
        const booteResult = kiBootAktionSchwer(team, fischbestand, verlauf, alleTeams, marketShipPrice)
        return {
            ...booteResult,
            ausgesandteBoote: kiAusgesandtSchwer(
                team.persoenlichkeit, team.name, booteResult.boote,
                fischbestand, verlauf, alleTeams
            ),
        }
    }
    const booteResult = kiBootAktionLeicht(team, marketShipPrice)
    return { ...booteResult, ausgesandteBoote: kiAusgesandtLeicht(booteResult.boote) }
}

// ─── Core round simulation — MIT order of debits & credits ───────────────────
//
// humanDecisions: { [slotIndex]: { ausgesandt, boatsOffered, shipsOrdered } }
//
// MIT Step sequence within a round:
//   (Ship deliveries from last round happen first)
//   Step 2: Auction buy/sell — already reflected in team.guthaben on entry
//   Step 3: Operating costs — ALL ships in fleet (Harbor + Coastal + Deep Sea)
//   Step 4: Fish catch & sales revenue
//   Step 5: Interest on MINIMUM balance reached during Steps 2–4
//   Step 6: New ship orders — paid now, delivered at start of NEXT round
function simuliereRunde(state, humanDecisions, schwierigkeit) {
    const marketShipPrice = state.marketShipPrice || GAME_CONFIG.auctionPreis
    const maxRunden = state.maxRunden || GAME_CONFIG.maxRunden

    // ── Deliver ships ordered last round (MIT: delivered at START of new year) ──
    const roundDeliveries = []
    const teamsNachLieferung = state.teams.map(team => {
        const delivered = team.shipsInDelivery || 0
        if (delivered > 0) {
            roundDeliveries.push({ name: team.name, farbe: team.farbe, count: delivered })
        }
        return { ...team, boote: team.boote + delivered, shipsInDelivery: 0 }
    })

    // ── Step 2: Fleet decisions (AI buy/sell + human pre-round sells already applied) ──
    const teamsNachEntscheidung = teamsNachLieferung.map((team, index) => {
        if (!team.istKI) {
            const d = humanDecisions[index] || { ausgesandt: 0, boatsOffered: 0, shipsOrdered: 0 }
            return { ...team, ausgesandteBoote: d.ausgesandt }
        }
        return { ...team, ...kiTeamAktionen(team, state.fischbestand, state.verlauf, teamsNachLieferung, schwierigkeit, marketShipPrice) }
    })

    const marktereignis = erzeugeMarktereignis()

    // ── Fish catch (shared pool) ──
    const gesamteBoote = teamsNachEntscheidung.reduce((sum, t) => sum + t.ausgesandteBoote, 0)
    const dichte = state.fischbestand / GAME_CONFIG.maxFischbestand
    const eff = 25 * Math.sqrt(Math.max(0, dichte))
    const gesamtFang = gesamteBoote > 0 ? Math.round(Math.min(gesamteBoote * eff, state.fischbestand)) : 0
    const neuerFischbestand = berechneFischbestand(state.fischbestand, gesamtFang)

    // ── Steps 3–6 per team ──
    let teamsNachRunde = teamsNachEntscheidung.map((team, index) => {
        const shipsOrdered = !team.istKI ? (humanDecisions[index]?.shipsOrdered || 0) : 0

        // Starting balance after Step 2 (pre-round auction activity)
        const startBalance = team.guthaben
        let balance = startBalance
        let minBalance = balance

        // Step 3: Operating costs — ALL ships in fleet (MIT: Harbor + Coastal + Deep Sea)
        const opCosts = team.boote * GAME_CONFIG.betriebskosten
        balance -= opCosts
        minBalance = Math.min(minBalance, balance)

        // Step 4: Fish catch & sales revenue
        const anteil = gesamteBoote > 0 ? team.ausgesandteBoote / gesamteBoote : 0
        const varianz = 0.85 + Math.random() * 0.30
        const fang = Math.round(gesamtFang * anteil * varianz)
        const fishRevenue = Math.round(fang * GAME_CONFIG.fischPreis * marktereignis)
        balance += fishRevenue
        minBalance = Math.min(minBalance, balance)   // fish income is positive; min won't change

        // Step 5: Interest on MINIMUM balance reached during the year
        const zinsen = Math.round(minBalance * GAME_CONFIG.zinsRate)
        balance += zinsen

        // Step 6: New ship orders — paid now, ships arrive at start of NEXT round
        const maxOrder = Math.ceil(team.boote / 2)
        const canAfford = balance >= GAME_CONFIG.bootKosten ? Math.floor(balance / GAME_CONFIG.bootKosten) : 0
        const actualOrder = Math.max(0, Math.min(shipsOrdered, maxOrder, canAfford))
        const orderCost = actualOrder * GAME_CONFIG.bootKosten
        balance -= orderCost

        return {
            ...team,
            letzterFang: fang,
            letzteZinsen: zinsen,
            guthaben: balance,
            shipsInDelivery: actualOrder,
            roundSummary: {
                startBalance,
                opCosts,
                fang,
                fishRevenue,
                minBalance,
                zinsen,
                actualOrder,
                orderCost,
                finalBalance: balance,
            },
            netWorth: berechneNetWorth(balance, team.boote, marketShipPrice),
        }
    })

    // ── Auction: human players selling ships to AI bidders ──
    let allAuctionEvents = []
    for (const [idxStr, decision] of Object.entries(humanDecisions)) {
        const idx = parseInt(idxStr)
        if ((decision.boatsOffered || 0) > 0) {
            const maxOffer = Math.min(decision.boatsOffered, Math.max(0, teamsNachRunde[idx].boote - 1))
            const { teams: updated, auctionEvents } = loeseAuktion(teamsNachRunde, idx, maxOffer, neuerFischbestand, marketShipPrice)
            teamsNachRunde = updated
            allAuctionEvents = [...allAuctionEvents, ...auctionEvents]
        }
    }

    const neuerMarktpreis = aktualisiereMarktpreis(marketShipPrice, teamsNachRunde)
    const finalTeams = teamsNachRunde.map(team => ({
        ...team,
        netWorth: berechneNetWorth(team.guthaben, team.boote, neuerMarktpreis),
    }))

    const verlaufEintrag = { runde: state.runde, fischbestand: state.fischbestand, gesamtFang, preisMultiplikator: marktereignis }
    finalTeams.forEach(team => { verlaufEintrag[team.name] = team.netWorth })

    const neueAuctionHistory = allAuctionEvents.some(e => e.erfolg)
        ? [...(state.auctionHistory || []), ...allAuctionEvents.filter(e => e.erfolg).map(e => ({ runde: state.runde, ...e }))]
        : (state.auctionHistory || [])

    return {
        ...state,
        runde: state.runde + 1,
        fischbestand: neuerFischbestand,
        marketShipPrice: neuerMarktpreis,
        teams: finalTeams,
        verlauf: [...state.verlauf, verlaufEintrag],
        auctionHistory: neueAuctionHistory,
        letzteAuktionEvents: allAuctionEvents,
        roundDeliveries,
        phase: state.runde >= maxRunden ? 'ende' : 'entscheidung',
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

function GamePage({ gameState, setGameState }) {
    const [humanDecisions, setHumanDecisions] = useState({})
    const [currentAusgesandt, setCurrentAusgesandt] = useState(1)
    const [currentBoatsOffered, setCurrentBoatsOffered] = useState(0)
    const [currentShipsOrdered, setCurrentShipsOrdered] = useState(0)
    const [showHandoff, setShowHandoff] = useState(false)
    const [rundenErgebnis, setRundenErgebnis] = useState(null)

    const maxRunden = gameState.maxRunden || GAME_CONFIG.maxRunden
    const schwierigkeit = gameState.schwierigkeitsgrad || 'leicht'
    const marketShipPrice = gameState.marketShipPrice || GAME_CONFIG.auctionPreis

    // All human teams in slot order
    const humanTeams = gameState.teams
        .map((t, i) => ({ ...t, slotIndex: i }))
        .filter(t => !t.istKI)

    // First human who hasn't submitted a decision yet
    const activeEntry = humanTeams.find(t => !humanDecisions[t.slotIndex])
    const activeSlot = activeEntry ? activeEntry.slotIndex : null
    const activeTeam = activeSlot !== null ? gameState.teams[activeSlot] : null

    // Next human after the active one (for handoff screen)
    const activeEntryIdx = activeEntry ? humanTeams.indexOf(activeEntry) : -1
    const nextEntry = activeEntryIdx >= 0 && activeEntryIdx < humanTeams.length - 1
        ? humanTeams[activeEntryIdx + 1]
        : null

    const safeAusgesandt = Math.min(currentAusgesandt, activeTeam ? activeTeam.boote : 1)
    const maxShipOrder = activeTeam ? Math.ceil(activeTeam.boote / 2) : 0
    const safeShipsOrdered = Math.min(currentShipsOrdered, maxShipOrder)

    // Sell ship instantly at market price (Step 2 auction sale — immediate)
    function handleBootVerkaufen() {
        if (activeSlot === null || activeTeam.boote <= 1) return
        setGameState({
            ...gameState,
            teams: gameState.teams.map((team, i) => {
                if (i !== activeSlot) return team
                const neuesGuthaben = team.guthaben + marketShipPrice
                const neueBoote = team.boote - 1
                return { ...team, boote: neueBoote, guthaben: neuesGuthaben, netWorth: berechneNetWorth(neuesGuthaben, neueBoote, marketShipPrice) }
            })
        })
    }

    function handleSubmit() {
        if (activeSlot === null) return
        const newDecisions = {
            ...humanDecisions,
            [activeSlot]: { ausgesandt: safeAusgesandt, boatsOffered: currentBoatsOffered, shipsOrdered: safeShipsOrdered }
        }
        const allDone = humanTeams.every(t => newDecisions[t.slotIndex] !== undefined)

        if (allDone) {
            resolveRound(newDecisions)
        } else {
            setHumanDecisions(newDecisions)
            setCurrentAusgesandt(1)
            setCurrentBoatsOffered(0)
            setCurrentShipsOrdered(0)
            if (humanTeams.length > 1) setShowHandoff(true)
        }
    }

    function resolveRound(decisions) {
        const nachRunde = simuliereRunde(gameState, decisions, schwierigkeit)
        setRundenErgebnis({
            runde: gameState.runde,
            teams: nachRunde.teams,
            fischDelta: nachRunde.fischbestand - gameState.fischbestand,
            neuerFischbestand: nachRunde.fischbestand,
            auctionEvents: nachRunde.letzteAuktionEvents || [],
            roundDeliveries: nachRunde.roundDeliveries || [],
            gameStateNachRunde: nachRunde,
        })
    }

    function handleWeiter() {
        if (!rundenErgebnis) return
        setGameState(rundenErgebnis.gameStateNachRunde)
        setRundenErgebnis(null)
        setHumanDecisions({})
        setCurrentAusgesandt(1)
        setCurrentBoatsOffered(0)
        setCurrentShipsOrdered(0)
    }

    function handleDevSkip() {
        let state = { ...gameState, verlauf: [...gameState.verlauf], teams: gameState.teams.map(t => ({ ...t })) }
        while (state.runde <= maxRunden && state.fischbestand > 0) {
            const decisions = {}
            state.teams.forEach((team, idx) => {
                if (!team.istKI) decisions[idx] = { ausgesandt: Math.max(1, Math.floor(team.boote * 0.6)), boatsOffered: 0, shipsOrdered: 0 }
            })
            state = simuliereRunde(state, decisions, schwierigkeit)
        }
        setGameState({ ...state, phase: 'ende' })
    }

    return (
        <div className="w-full h-screen bg-blue-900 text-white flex flex-col overflow-y-auto">

            {/* Handoff overlay (same-device multiplayer) */}
            {showHandoff && nextEntry && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
                    <div className="bg-blue-900 border border-blue-600 rounded-xl p-6 max-w-sm w-full text-center shadow-2xl">
                        <h2 className="text-xl font-bold mb-2">Decision Submitted!</h2>
                        <p className="text-blue-300 mb-4">Please pass the device to:</p>
                        <div className="text-2xl font-bold mb-5">
                            {gameState.teams[nextEntry.slotIndex].farbe} {gameState.teams[nextEntry.slotIndex].name}
                        </div>
                        <button
                            onClick={() => setShowHandoff(false)}
                            className="w-full bg-green-500 hover:bg-green-400 font-bold py-3 rounded-xl text-base transition-colors"
                        >
                            I'm ready →
                        </button>
                    </div>
                </div>
            )}

            {/* Round result modal */}
            {rundenErgebnis && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-blue-900 border border-blue-600 rounded-xl p-5 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-bold mb-1 text-center">Round {rundenErgebnis.runde} – Results</h2>
                        <p className="text-blue-300 text-xs text-center mb-3">What happened this round?</p>

                        {/* Ship delivery notification */}
                        {rundenErgebnis.roundDeliveries.length > 0 && (
                            <div className="bg-green-500/15 border border-green-400/30 rounded-lg p-2.5 mb-3">
                                <div className="font-bold text-xs text-green-300 mb-1">Ships delivered at start of round</div>
                                {rundenErgebnis.roundDeliveries.map((d, i) => (
                                    <div key={i} className="text-xs text-green-200">
                                        {d.farbe} {d.name}: +{d.count} ship{d.count !== 1 ? 's' : ''} from last round's order
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Per-team round summary breakdown */}
                        <div className="space-y-2 mb-3">
                            {rundenErgebnis.teams.map(team => {
                                const s = team.roundSummary
                                if (!s) return null
                                return (
                                    <div key={team.name} className="bg-white/10 rounded-lg p-2.5">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="font-bold text-xs">{team.farbe} {team.name} {team.istKI ? '🤖' : ''}</span>
                                            <span className="text-xs text-blue-300">{s.fang} fish caught</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-3 text-xs text-blue-200 leading-relaxed">
                                            <div>Start balance: <span className="text-white">{s.startBalance.toLocaleString()}€</span></div>
                                            <div>Op costs ({team.boote} ships): <span className="text-red-300">−{s.opCosts.toLocaleString()}€</span></div>
                                            <div>Fish sales: <span className="text-green-300">+{s.fishRevenue.toLocaleString()}€</span></div>
                                            <div>Min balance: <span className="text-yellow-300">{s.minBalance.toLocaleString()}€</span></div>
                                            <div>Interest (2%): <span className={s.zinsen >= 0 ? 'text-green-300' : 'text-red-300'}>{s.zinsen >= 0 ? '+' : ''}{s.zinsen.toLocaleString()}€</span></div>
                                            <div>Ship orders ({s.actualOrder} × 300€): <span className="text-red-300">−{s.orderCost.toLocaleString()}€</span></div>
                                        </div>
                                        <div className="mt-1.5 pt-1.5 border-t border-white/10 flex justify-between items-center">
                                            <span className="text-xs font-bold">Final balance: {s.finalBalance.toLocaleString()}€</span>
                                            {team.shipsInDelivery > 0 && (
                                                <span className="text-xs text-green-300">+{team.shipsInDelivery} ship{team.shipsInDelivery !== 1 ? 's' : ''} arriving next round</span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Auction results */}
                        {rundenErgebnis.auctionEvents.length > 0 && (
                            <div className="bg-yellow-500/10 border border-yellow-400/20 rounded-lg p-2.5 mb-3">
                                <div className="font-bold text-xs text-yellow-300 mb-1">Auction Result</div>
                                {rundenErgebnis.auctionEvents.map((ev, i) => (
                                    <div key={i} className="text-xs text-blue-200">
                                        {ev.erfolg
                                            ? `1 ship → ${ev.kaeufer} for ${ev.preis.toLocaleString()}€`
                                            : 'No bid – ship not sold'}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Fish stock delta */}
                        <div className={`rounded-lg p-2.5 mb-3 text-center font-bold text-sm ${rundenErgebnis.fischDelta < 0 ? 'bg-red-500/20 text-red-200' : 'bg-green-500/20 text-green-200'}`}>
                            Fish stock: {rundenErgebnis.fischDelta > 0 ? '+' : ''}{rundenErgebnis.fischDelta.toLocaleString()} → now {rundenErgebnis.neuerFischbestand.toLocaleString()} / {GAME_CONFIG.maxFischbestand.toLocaleString()}
                        </div>

                        {rundenErgebnis.neuerFischbestand < GAME_CONFIG.maxFischbestand * 0.40 && (
                            <div className="bg-orange-500/20 border border-orange-400/40 rounded-lg p-2.5 mb-3 text-xs text-orange-200 text-center">
                                <strong>Warning:</strong> Fish stock below 40%!
                            </div>
                        )}

                        <button
                            onClick={handleWeiter}
                            className="w-full bg-green-500 hover:bg-green-400 font-bold py-2.5 rounded-xl transition-colors text-base"
                        >
                            Next Round →
                        </button>
                    </div>
                </div>
            )}

            {/* Header — compact strip */}
            <div className="flex-none flex justify-between items-center px-4 py-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <h1 className="text-base font-bold">Fish Banks Game</h1>
                    <span className="text-xs px-2 py-0.5 rounded font-medium bg-yellow-500/20 text-yellow-300">
                        Ship market: {marketShipPrice.toLocaleString()}€
                    </span>
                    {humanTeams.length > 1 && activeTeam && (
                        <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-500/30 text-blue-200">
                            {activeTeam.name} ({activeEntryIdx + 1}/{humanTeams.length})
                        </span>
                    )}
                </div>
                <div className="text-right">
                    <div className="text-xs text-blue-200 leading-none">Round</div>
                    <div className="text-xl font-bold leading-tight">{gameState.runde} / {maxRunden}</div>
                </div>
            </div>

            {/* Main two-column layout */}
            <div className="flex-1 min-h-0 grid grid-cols-2 gap-3 p-3">

                {/* Left: fish stock bar + graph */}
                <div className="flex flex-col gap-2 min-h-0">
                    {(() => {
                        const dichte = fischDichte(gameState.fischbestand)
                        const pct = Math.round(dichte * 100)
                        return (
                            <div className={`flex-none bg-white/10 rounded-xl px-3 py-2 ${dichte <= 0.30 ? 'pulse-critical' : ''}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-sm">Fish Stock</span>
                                    <span className="font-bold text-sm">{gameState.fischbestand.toLocaleString()} / {GAME_CONFIG.maxFischbestand.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden mb-1">
                                    <div
                                        className="h-2.5 rounded-full fish-bar-transition"
                                        style={{
                                            width: `${pct}%`,
                                            backgroundColor: dichte > 0.60 ? '#22c55e' : dichte > 0.30 ? '#f59e0b' : '#ef4444'
                                        }}
                                    />
                                </div>
                                <div className={`text-xs ${dichte > 0.60 ? 'text-green-300' : dichte > 0.30 ? 'text-yellow-300' : 'text-red-300'}`}>
                                    {dichte > 0.60 ? 'Healthy' : dichte > 0.30 ? 'Endangered' : 'Critical!'}
                                </div>
                            </div>
                        )
                    })()}

                    <div className="flex-1 min-h-0">
                        <FishGraph verlauf={gameState.verlauf} />
                    </div>
                </div>

                {/* Right: team cards + decision panel */}
                <div className="flex flex-col gap-2 min-h-0">

                    {/* Team cards — 2×2 compact grid */}
                    <div className="flex-none grid grid-cols-2 gap-2">
                        {gameState.teams.map((team, index) => {
                            const isActive = index === activeSlot
                            const hasSubmitted = !team.istKI && humanDecisions[index] !== undefined
                            return (
                                <div
                                    key={team.name}
                                    className={`rounded-xl px-3 py-2 transition-all ${
                                        isActive ? 'bg-green-600/80 ring-2 ring-green-400' :
                                        hasSubmitted ? 'bg-green-900/50' :
                                        'bg-white/10'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className="font-bold text-xs">{team.farbe} {team.name}</span>
                                        <span className="text-xs opacity-70">
                                            {team.istKI ? '🤖' : hasSubmitted ? '✓' : isActive ? '' : '…'}
                                        </span>
                                    </div>
                                    {team.persoenlichkeit && (
                                        <div className="text-xs text-blue-300">{PERSOENLICHKEIT_LABEL[team.persoenlichkeit]}</div>
                                    )}
                                    <div className="text-xs text-blue-200">Balance: {team.guthaben.toLocaleString()}€</div>
                                    <div className="text-xs text-blue-200">Fleet: {(team.boote * marketShipPrice).toLocaleString()}€ ({team.boote} ships)</div>
                                    <div className="text-xs font-bold">Net Worth: {team.netWorth.toLocaleString()}€</div>
                                    {team.letzterFang > 0 && (
                                        <div className="text-xs text-blue-300">Catch: {team.letzterFang} | Interest: {team.letzteZinsen >= 0 ? '+' : ''}{team.letzteZinsen}€</div>
                                    )}
                                    {(team.shipsInDelivery || 0) > 0 && (
                                        <div className="text-xs text-green-300">+{team.shipsInDelivery} arriving next round</div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Decision panel */}
                    {activeTeam ? (
                        <div className="flex-1 min-h-0 bg-white/10 rounded-xl p-3 flex flex-col gap-2">

                            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
                                <div>
                                    <h2 className="font-bold text-sm">{activeTeam.name} – Your Decision</h2>
                                    <p className="text-blue-200 text-xs">How many ships to deploy? (max. {activeTeam.boote})</p>
                                </div>

                                {/* Ship delivery notice */}
                                {(activeTeam.shipsInDelivery || 0) > 0 && (
                                    <div className="bg-green-500/15 border border-green-400/30 rounded-lg px-2.5 py-1.5 text-xs text-green-200">
                                        {activeTeam.shipsInDelivery} ship{activeTeam.shipsInDelivery !== 1 ? 's' : ''} arriving this round from last round's order
                                    </div>
                                )}

                                {/* Ships deployed counter */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setCurrentAusgesandt(Math.max(0, safeAusgesandt - 1))}
                                        className="bg-white/20 hover:bg-white/30 w-9 h-9 rounded-full text-lg font-bold flex items-center justify-center shrink-0"
                                    >−</button>
                                    <div
                                        className="font-bold w-12 text-center text-white"
                                        style={{ fontSize: 'clamp(1.25rem, 2.5vh, 2rem)' }}
                                    >{safeAusgesandt}</div>
                                    <button
                                        onClick={() => setCurrentAusgesandt(Math.min(activeTeam.boote, safeAusgesandt + 1))}
                                        className="bg-white/20 hover:bg-white/30 w-9 h-9 rounded-full text-lg font-bold flex items-center justify-center shrink-0"
                                    >+</button>
                                    <div className="text-blue-200 text-xs">of {activeTeam.boote} ships deployed</div>
                                </div>

                                {/* Sell ship (instant auction sale) + New ship order */}
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={handleBootVerkaufen}
                                        disabled={activeTeam.boote <= 1}
                                        className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed font-bold py-2 rounded-xl transition-colors text-xs"
                                    >
                                        Sell Ship<br />
                                        <span className="font-normal">{marketShipPrice.toLocaleString()}€ (instant)</span>
                                    </button>

                                    {/* New ship order: paid after income, delivered next round (MIT Step 6) */}
                                    <div className="bg-blue-500/20 border border-blue-400/20 rounded-xl px-2.5 py-2">
                                        <div className="text-xs font-bold text-blue-200 mb-1">Order New Ships</div>
                                        <div className="text-xs text-blue-400 mb-1.5">300€ each · paid after income · max {maxShipOrder}</div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => setCurrentShipsOrdered(Math.max(0, safeShipsOrdered - 1))}
                                                className="bg-white/20 hover:bg-white/30 w-6 h-6 rounded-full font-bold text-sm flex items-center justify-center shrink-0"
                                            >−</button>
                                            <div className="text-base font-bold w-6 text-center">{safeShipsOrdered}</div>
                                            <button
                                                onClick={() => setCurrentShipsOrdered(Math.min(maxShipOrder, safeShipsOrdered + 1))}
                                                className="bg-white/20 hover:bg-white/30 w-6 h-6 rounded-full font-bold text-sm flex items-center justify-center shrink-0"
                                            >+</button>
                                            {safeShipsOrdered > 0 && (
                                                <div className="text-xs text-blue-300">−{(safeShipsOrdered * GAME_CONFIG.bootKosten).toLocaleString()}€</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Auction: offer ships to AI bidders */}
                                {activeTeam.boote > 1 && (
                                    <div className="bg-yellow-500/10 border border-yellow-400/20 rounded-lg px-3 py-2">
                                        <div className="text-xs text-yellow-300 font-bold mb-1">Offer Ships at Auction</div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setCurrentBoatsOffered(Math.max(0, currentBoatsOffered - 1))}
                                                className="bg-white/20 hover:bg-white/30 w-7 h-7 rounded-full font-bold text-sm flex items-center justify-center shrink-0"
                                            >−</button>
                                            <div className="text-lg font-bold w-7 text-center">{currentBoatsOffered}</div>
                                            <button
                                                onClick={() => setCurrentBoatsOffered(Math.min(activeTeam.boote - 1, currentBoatsOffered + 1))}
                                                className="bg-white/20 hover:bg-white/30 w-7 h-7 rounded-full font-bold text-sm flex items-center justify-center shrink-0"
                                            >+</button>
                                            <div className="text-xs text-blue-300">min. 150€ starting bid</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Pinned buttons */}
                            <div className="flex-none flex flex-col gap-1.5">
                                {import.meta.env.DEV && (
                                    <button
                                        onClick={handleDevSkip}
                                        className="w-full bg-purple-600 hover:bg-purple-500 font-bold py-1.5 rounded-xl transition-colors text-xs"
                                    >
                                        DEV: Simulate Game
                                    </button>
                                )}
                                <button
                                    onClick={handleSubmit}
                                    className="w-full bg-green-500 hover:bg-green-400 font-bold py-2.5 rounded-xl text-sm transition-colors"
                                >
                                    Confirm Round
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 bg-white/10 rounded-xl p-3 flex flex-col items-center justify-center gap-2">
                            <p className="text-blue-300 text-center text-xs">
                                All decisions submitted.<br />Processing round…
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default GamePage
