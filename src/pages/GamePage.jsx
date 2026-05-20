import FishGraph from '../components/FishGraph'
import { useState } from 'react'
import {
    GAME_CONFIG, berechneFischbestand, berechneNetWorth,
    kiBootAktionLeicht, kiAusgesandtLeicht,
    kiBootAktionSchwer, kiAusgesandtSchwer,
    erzeugeMarktereignis, kiZoneAllokierung,
} from '../game/fishLogic'

// ─── MIT Order Verification Test (DEV only) ───────────────────────────────────
// Scenario: fleet=3 ships (1 harbor, 1 coastal, 1 deep sea), startBalance=$5000
// Step 3: op costs  1×$50 + 1×$150 + 1×$250 = $450  → balance $4550, min $4550
// Step 4: fish      30 fish × $20 = $600             → balance $5150, min stays $4550
// Step 5: interest  $4550 × 2% = $91                 → balance $5241
// Step 6: no orders
if (import.meta.env.DEV) {
    ;(function verifyMITZoneCosts() {
        const startBalance = 5000
        const fleet = 3
        const harborSh = 1, coastalSh = 1, deepSeaSh = 1
        const fang = 30

        let balance = startBalance
        let minBalance = balance

        const opCosts = harborSh * GAME_CONFIG.harborCost + coastalSh * GAME_CONFIG.coastalCost + deepSeaSh * GAME_CONFIG.deepSeaCost
        balance -= opCosts
        minBalance = Math.min(minBalance, balance)

        const fishRevenue = fang * GAME_CONFIG.fischPreis
        balance += fishRevenue
        minBalance = Math.min(minBalance, balance)

        const zinsen = Math.round(minBalance * GAME_CONFIG.zinsRate)
        balance += zinsen

        const pass = opCosts === 450 && minBalance === 4550 && zinsen === 91 && balance === 5241
        console.log('[MIT Zone Cost Test]')
        console.log(`  Start: ${startBalance}€  |  Fleet: 1H + 1C + 1D`)
        console.log(`  Op costs: 1×$50 + 1×$150 + 1×$250 = −${opCosts}€  → ${startBalance - opCosts}€`)
        console.log(`  Fish sales: ${fang} × $20 = +${fishRevenue}€  → ${startBalance - opCosts + fishRevenue}€`)
        console.log(`  Min balance: ${minBalance}€  |  Interest: +${zinsen}€  → ${balance}€`)
        console.log(`  ${pass ? 'PASS ✅' : 'FAIL ❌'}  expected: opCosts=450, minBalance=4550, interest=91, final=5241`)
    })()
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PERSOENLICHKEIT_LABEL = {
    gierig:     'Greedy',
    kooperativ: 'Cooperative',
    rational:   'Rational',
}

function aktualisiereMarktpreis(aktuellPreis, alleTeams) {
    const totalBoote = alleTeams.reduce((sum, t) => sum + t.fleet, 0)
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
    return Math.min(maxBid, team.bankBalance)
}

function loeseAuktion(teams, sellerIdx, anzahlAngebote, fischbestand, marketShipPrice) {
    if (anzahlAngebote === 0) return { teams, auctionEvents: [] }
    let t = teams.map(x => ({ ...x }))
    const auctionEvents = []
    for (let i = 0; i < anzahlAngebote; i++) {
        if (t[sellerIdx].fleet <= 1) break
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
            t[sellerIdx] = { ...t[sellerIdx], fleet: t[sellerIdx].fleet - 1, bankBalance: t[sellerIdx].bankBalance + bestBid }
            t[bestBidderIdx] = { ...t[bestBidderIdx], fleet: t[bestBidderIdx].fleet + 1, bankBalance: t[bestBidderIdx].bankBalance - bestBid }
            auctionEvents.push({ erfolg: true, kaeufer: t[bestBidderIdx].name, preis: bestBid })
        }
    }
    return { teams: t, auctionEvents }
}

function kiTeamAktionen(team, fischbestand, verlauf, alleTeams, schwierigkeit, marketShipPrice, params) {
    let result
    if (schwierigkeit === 'schwer') {
        const booteResult = kiBootAktionSchwer(team, fischbestand, verlauf, alleTeams, marketShipPrice, params)
        result = {
            ...booteResult,
            ausgesandteBoote: kiAusgesandtSchwer(
                team.persoenlichkeit, team.name, booteResult.fleet,
                fischbestand, verlauf, alleTeams, params
            ),
        }
    } else {
        const booteResult = kiBootAktionLeicht(team, marketShipPrice, params)
        result = { ...booteResult, ausgesandteBoote: kiAusgesandtLeicht(booteResult.fleet) }
    }
    const zones = kiZoneAllokierung(team.persoenlichkeit || 'kooperativ', result.fleet, result.ausgesandteBoote, fischbestand, params)
    return { ...result, ...zones }
}

// ─── Core round simulation — MIT order of debits & credits ───────────────────
//
// humanDecisions: { [slotIndex]: { harbor, coastal, deepSea, boatsOffered, shipsOrdered } }
//
// MIT Step sequence within a round:
//   (Ship deliveries from last round happen first)
//   Step 2: Auction buy/sell — already reflected in team.bankBalance on entry
//   Step 3: Operating costs — ALL ships in fleet (Harbor, Coastal, Deep Sea)
//   Step 4: Fish catch & sales revenue (zone-based: coastal 15/ship, deep sea 25/ship)
//   Step 5: Interest on MINIMUM balance reached during Steps 2–4
//   Step 6: New ship orders — paid now, delivered at start of NEXT round
function simuliereRunde(state, humanDecisions, schwierigkeit) {
    const marketShipPrice = state.marketShipPrice || GAME_CONFIG.auctionPreis
    const maxRunden = state.maxRunden || GAME_CONFIG.maxRunden
    const params = state.params
    const fishPrice = params?.fishPrice ?? GAME_CONFIG.fischPreis
    const newShipPrice = params?.newShipPrice ?? GAME_CONFIG.bootKosten
    const interestRate = params?.interestRate ?? GAME_CONFIG.zinsRate
    const harborCostRate  = params?.harborCost  ?? GAME_CONFIG.harborCost
    const coastalCostRate = params?.coastalCost ?? GAME_CONFIG.coastalCost
    const deepSeaCostRate = params?.deepSeaCost ?? GAME_CONFIG.deepSeaCost
    const maxFisch = params?.maxFishPopulation ?? GAME_CONFIG.maxFischbestand

    // ── Deliver ships ordered last round (MIT: delivered at START of new year) ──
    const roundDeliveries = []
    const teamsNachLieferung = state.teams.map(team => {
        const delivered = team.shipsInDelivery || 0
        if (delivered > 0) {
            roundDeliveries.push({ name: team.name, farbe: team.farbe, count: delivered })
        }
        return { ...team, fleet: team.fleet + delivered, shipsInDelivery: 0 }
    })

    if (import.meta.env.DEV) {
        console.log(`\n=== ROUND ${state.runde} PROCESSING ===`)
        if (roundDeliveries.length > 0)
            roundDeliveries.forEach(d => console.log(`  Step 1 - Ships delivered to ${d.name}: +${d.count}`))
        else
            console.log('  Step 1 - No ship deliveries')
    }

    // ── Step 2: Fleet decisions (AI buy/sell + human pre-round sells already applied) ──
    const teamsNachEntscheidung = teamsNachLieferung.map((team, index) => {
        if (!team.istKI) {
            const d = humanDecisions[index] || { harbor: 0, coastal: 0, deepSea: 0, boatsOffered: 0, shipsOrdered: 0 }
            const harbor = d.harbor || 0
            const coastal = d.coastal || 0
            const deepSea = d.deepSea || 0
            return {
                ...team,
                harborShips: harbor,
                coastalShips: coastal,
                deepSeaShips: deepSea,
                ausgesandteBoote: coastal + deepSea,
            }
        }
        return { ...team, ...kiTeamAktionen(team, state.fischbestand, state.verlauf, teamsNachLieferung, schwierigkeit, marketShipPrice, params) }
    })

    // ONE weather roll per round — same value used for all teams (MIT spec)
    const wetterfaktor = erzeugeMarktereignis()

    // ── Fish catch: per-team zone calculation with weather factor ──
    // Formula: teamCatch = (coastalShips × 15 + deepSeaShips × 25) × sqrt(density) × weatherFactor
    const dichte = state.fischbestand / maxFisch
    const sqrtDichte = Math.sqrt(Math.max(0, dichte))
    const teamCatches = teamsNachEntscheidung.map(t => {
        const coastal = Math.round((t.coastalShips || 0) * 15 * sqrtDichte * wetterfaktor)
        const deepSea = Math.round((t.deepSeaShips || 0) * 25 * sqrtDichte * wetterfaktor)
        return { coastal, deepSea, total: coastal + deepSea }
    })
    const rawTotalCatch = teamCatches.reduce((sum, c) => sum + c.total, 0)
    const capFactor = rawTotalCatch > 0 && rawTotalCatch > state.fischbestand
        ? state.fischbestand / rawTotalCatch
        : 1
    const gesamtFang = Math.round(Math.min(rawTotalCatch, state.fischbestand))
    const neuerFischbestand = berechneFischbestand(state.fischbestand, gesamtFang, params)

    // ── Steps 3–6 per team ──
    let teamsNachRunde = teamsNachEntscheidung.map((team, index) => {
        const shipsOrdered = !team.istKI ? (humanDecisions[index]?.shipsOrdered || 0) : 0

        // Starting balance after Step 2 (pre-round auction activity)
        const startBalance = team.bankBalance
        let balance = startBalance
        let minBalance = balance

        // Step 3: Operating costs — zone-based per ship per MIT spec
        const harborSh  = team.harborShips  || 0
        const coastalSh = team.coastalShips || 0
        const deepSeaSh = team.deepSeaShips || 0
        const deployedShips = team.fleet
        const opCosts = harborSh * harborCostRate + coastalSh * coastalCostRate + deepSeaSh * deepSeaCostRate
        balance -= opCosts
        minBalance = Math.min(minBalance, balance)

        // Step 4: Fish catch & sales revenue (zone-based, capped proportionally)
        const catches = teamCatches[index]
        const coastalFang = Math.round(catches.coastal * capFactor)
        const deepSeaFang = Math.round(catches.deepSea * capFactor)
        const fang = coastalFang + deepSeaFang
        const fishRevenue = Math.round(fang * fishPrice)
        balance += fishRevenue
        minBalance = Math.min(minBalance, balance)   // fish income is positive; min won't change

        // Step 5: Interest on MINIMUM balance reached during the year
        const zinsen = Math.round(minBalance * interestRate)
        balance += zinsen

        // Step 6: New ship orders — paid now, ships arrive at start of NEXT round
        const maxOrder = Math.ceil(team.fleet / 2)
        const canAfford = balance >= newShipPrice ? Math.floor(balance / newShipPrice) : 0
        const actualOrder = Math.max(0, Math.min(shipsOrdered, maxOrder, canAfford))
        const orderCost = actualOrder * newShipPrice
        balance -= orderCost

        if (import.meta.env.DEV) {
            console.log(`  [${team.name}] Step 2 - After auction:         ${startBalance.toLocaleString()}€`)
            console.log(`  [${team.name}] Step 3 - After operating costs: ${(startBalance - opCosts).toLocaleString()}€  (−${opCosts}€ | H:${harborSh}×${harborCostRate} C:${coastalSh}×${coastalCostRate} D:${deepSeaSh}×${deepSeaCostRate})`)
            console.log(`  [${team.name}] Step 4 - After fish sales:      ${(startBalance - opCosts + fishRevenue).toLocaleString()}€  (+${fishRevenue}€, ${fang} fish)`)
            console.log(`  [${team.name}] Step 5 - Min balance was: ${minBalance.toLocaleString()}€  Interest: ${zinsen >= 0 ? '+' : ''}${zinsen.toLocaleString()}€`)
            console.log(`  [${team.name}] Step 6 - After ship orders:     ${balance.toLocaleString()}€  (${actualOrder} × ${newShipPrice}€ ordered)`)
        }

        return {
            ...team,
            letzterFang: fang,
            letzteZinsen: zinsen,
            bankBalance: balance,
            shipsInDelivery: actualOrder,
            roundSummary: {
                startBalance,
                opCosts,
                deployedShips,
                harborShips: team.harborShips || 0,
                coastalShips: team.coastalShips || 0,
                deepSeaShips: team.deepSeaShips || 0,
                coastalFang,
                deepSeaFang,
                fang,
                wetterfaktor,
                fishRevenue,
                minBalance,
                zinsen,
                actualOrder,
                orderCost,
                newShipPrice,
                finalBalance: balance,
            },
            netWorth: berechneNetWorth(balance, team.fleet, marketShipPrice),
        }
    })

    // ── Auction: human players selling ships to AI bidders ──
    let allAuctionEvents = []
    for (const [idxStr, decision] of Object.entries(humanDecisions)) {
        const idx = parseInt(idxStr)
        if ((decision.boatsOffered || 0) > 0) {
            const maxOffer = Math.min(decision.boatsOffered, Math.max(0, teamsNachRunde[idx].fleet - 1))
            const { teams: updated, auctionEvents } = loeseAuktion(teamsNachRunde, idx, maxOffer, neuerFischbestand, marketShipPrice)
            teamsNachRunde = updated
            allAuctionEvents = [...allAuctionEvents, ...auctionEvents]
        }
    }

    const neuerMarktpreis = aktualisiereMarktpreis(marketShipPrice, teamsNachRunde)
    const finalTeams = teamsNachRunde.map(team => ({
        ...team,
        netWorth: berechneNetWorth(team.bankBalance, team.fleet, neuerMarktpreis),
    }))

    if (import.meta.env.DEV) {
        console.log(`  Step 7 - Fish stock: ${state.fischbestand.toLocaleString()} → ${neuerFischbestand.toLocaleString()}  (total catch: ${gesamtFang}, weather: ${wetterfaktor.toFixed(2)}×)`)
        finalTeams.forEach(t => console.log(`  Step 8 - Net Worth [${t.name}]: ${t.netWorth.toLocaleString()}€  (${t.bankBalance.toLocaleString()}€ + ${t.fleet} ships × ${neuerMarktpreis}€)`))
        console.log('=== END ROUND ===')
    }

    const verlaufEintrag = { runde: state.runde, fischbestand: state.fischbestand, gesamtFang, wetterfaktor }
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
        letzterWetterfaktor: wetterfaktor,
        letzterGesamtFang: gesamtFang,
        phase: state.runde >= maxRunden ? 'ende' : 'entscheidung',
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

function GamePage({ gameState, setGameState }) {
    const [humanDecisions, setHumanDecisions] = useState({})
    const [currentHarbor, setCurrentHarbor] = useState(0)
    const [currentCoastal, setCurrentCoastal] = useState(0)
    const [currentDeepSea, setCurrentDeepSea] = useState(() => {
        const firstHuman = gameState.teams.find(t => !t.istKI)
        return firstHuman ? firstHuman.fleet : 0
    })
    const [currentBoatsOffered, setCurrentBoatsOffered] = useState(0)
    const [currentShipsOrdered, setCurrentShipsOrdered] = useState(0)
    const [showHandoff, setShowHandoff] = useState(false)
    const [rundenErgebnis, setRundenErgebnis] = useState(null)
    const [activeTab, setActiveTab] = useState('dashboard')

    const maxRunden = gameState.maxRunden || GAME_CONFIG.maxRunden
    const schwierigkeit = gameState.schwierigkeitsgrad || 'leicht'
    const marketShipPrice = gameState.marketShipPrice || GAME_CONFIG.auctionPreis
    const showFishStock = gameState.params?.showFishStock ?? true
    const showOtherCatches = gameState.params?.showOtherCatches ?? true
    const newShipPriceUI = gameState.params?.newShipPrice ?? GAME_CONFIG.bootKosten
    const maxFischUI = gameState.params?.maxFishPopulation ?? GAME_CONFIG.maxFischbestand

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

    const fleetSize = activeTeam ? activeTeam.fleet : 0
    const totalAllocated = currentHarbor + currentCoastal + currentDeepSea
    const allAllocated = totalAllocated === fleetSize
    const maxShipOrder = activeTeam ? Math.ceil(activeTeam.fleet / 2) : 0
    const safeShipsOrdered = Math.min(currentShipsOrdered, maxShipOrder)

    // Sell ship instantly at market price (Step 2 auction sale — immediate)
    function handleBootVerkaufen() {
        if (activeSlot === null || activeTeam.fleet <= 1) return
        const neueBoote = activeTeam.fleet - 1
        // Shrink zone allocation to match new fleet — reduce deepSea first, then coastal, then harbor
        let h = currentHarbor, c = currentCoastal, d = currentDeepSea
        if (h + c + d > neueBoote) {
            if (d > 0) d--
            else if (c > 0) c--
            else h--
        }
        setCurrentHarbor(h)
        setCurrentCoastal(c)
        setCurrentDeepSea(d)
        setGameState({
            ...gameState,
            teams: gameState.teams.map((team, i) => {
                if (i !== activeSlot) return team
                const newBankBalance = team.bankBalance + marketShipPrice
                return { ...team, fleet: neueBoote, bankBalance: newBankBalance, netWorth: berechneNetWorth(newBankBalance, neueBoote, marketShipPrice) }
            })
        })
    }

    function handleSubmit() {
        if (activeSlot === null) return
        const newDecisions = {
            ...humanDecisions,
            [activeSlot]: {
                harbor: currentHarbor,
                coastal: currentCoastal,
                deepSea: currentDeepSea,
                boatsOffered: currentBoatsOffered,
                shipsOrdered: safeShipsOrdered,
            }
        }
        const allDone = humanTeams.every(t => newDecisions[t.slotIndex] !== undefined)

        if (allDone) {
            resolveRound(newDecisions)
            setCurrentHarbor(0)
            setCurrentCoastal(0)
            setCurrentDeepSea(0)
        } else {
            setHumanDecisions(newDecisions)
            // Reset zone allocator for the next player's fleet
            if (nextEntry) {
                const nextTeam = gameState.teams[nextEntry.slotIndex]
                setCurrentDeepSea(nextTeam.fleet)
            } else {
                setCurrentDeepSea(0)
            }
            setCurrentHarbor(0)
            setCurrentCoastal(0)
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
            alterFischbestand: gameState.fischbestand,
            fischDelta: nachRunde.fischbestand - gameState.fischbestand,
            neuerFischbestand: nachRunde.fischbestand,
            wetterfaktor: nachRunde.letzterWetterfaktor,
            gesamtFang: nachRunde.letzterGesamtFang,
            auctionEvents: nachRunde.letzteAuktionEvents || [],
            roundDeliveries: nachRunde.roundDeliveries || [],
            gameStateNachRunde: nachRunde,
        })
    }

    function handleWeiter() {
        if (!rundenErgebnis) return
        const newState = rundenErgebnis.gameStateNachRunde
        const firstHumanTeam = newState.teams.find(t => !t.istKI)
        setGameState(newState)
        setRundenErgebnis(null)
        setHumanDecisions({})
        setCurrentHarbor(0)
        setCurrentCoastal(0)
        setCurrentDeepSea(firstHumanTeam ? firstHumanTeam.fleet : 0)
        setCurrentBoatsOffered(0)
        setCurrentShipsOrdered(0)
    }

    function handleDevSkip() {
        let state = { ...gameState, verlauf: [...gameState.verlauf], teams: gameState.teams.map(t => ({ ...t })) }
        while (state.runde <= maxRunden && state.fischbestand > 0) {
            const decisions = {}
            state.teams.forEach((team, idx) => {
                if (!team.istKI) {
                    const deployed = Math.max(1, Math.floor(team.fleet * 0.6))
                    decisions[idx] = { harbor: team.fleet - deployed, coastal: 0, deepSea: deployed, boatsOffered: 0, shipsOrdered: 0 }
                }
            })
            state = simuliereRunde(state, decisions, schwierigkeit)
        }
        setGameState({ ...state, phase: 'ende' })
    }

    // ── Tab helpers ──────────────────────────────────────────────────────────────

    const tabs = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'reports',   label: 'Reports' },
        { id: 'market',    label: 'Market' },
    ]

    const fishDichte = gameState.fischbestand / maxFischUI
    const fishPct    = Math.round(fishDichte * 100)

    return (
        <div className="w-full h-screen bg-blue-900 text-white flex flex-col">

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

                        <div className="space-y-2 mb-3">
                            {(showOtherCatches ? rundenErgebnis.teams : rundenErgebnis.teams.filter(t => !t.istKI)).map(team => {
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
                                            <div>Op costs: <span className="text-red-300">−{s.opCosts.toLocaleString()}€</span></div>
                                            <div>Fish sales: <span className="text-green-300">+{s.fishRevenue.toLocaleString()}€</span></div>
                                            <div>Min balance: <span className="text-yellow-300">{s.minBalance.toLocaleString()}€</span></div>
                                            <div>{s.zinsen >= 0 ? 'Interest:' : 'Interest charged:'} <span className={s.zinsen >= 0 ? 'text-green-300' : 'text-red-300'}>{s.zinsen >= 0 ? '+' : ''}{s.zinsen.toLocaleString()}€</span></div>
                                            <div>Ship orders ({s.actualOrder} × {(s.newShipPrice ?? newShipPriceUI).toLocaleString()}€): <span className="text-red-300">−{s.orderCost.toLocaleString()}€</span></div>
                                        </div>
                                        <div className="mt-1 pt-1 border-t border-white/10 grid grid-cols-3 gap-x-2 text-xs text-blue-300 leading-relaxed">
                                            <div>Harbor ({s.harborShips}): $50/ship</div>
                                            <div>Coastal ({s.coastalShips}): {s.coastalFang} fish</div>
                                            <div>Deep Sea ({s.deepSeaShips}): {s.deepSeaFang} fish</div>
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

                        <div className={`rounded-lg p-2.5 mb-3 ${rundenErgebnis.fischDelta < 0 ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                            <div className="grid grid-cols-2 gap-x-3 text-xs leading-relaxed mb-1.5">
                                <div className="text-blue-200">Total catch: <span className="text-white font-bold">{(rundenErgebnis.gesamtFang || 0).toLocaleString()} fish</span></div>
                                <div className="text-blue-200">Weather: <span className="text-white font-bold">{rundenErgebnis.wetterfaktor != null ? rundenErgebnis.wetterfaktor.toFixed(2) : '—'}×</span></div>
                            </div>
                            <div className={`font-bold text-sm text-center ${rundenErgebnis.fischDelta < 0 ? 'text-red-200' : 'text-green-200'}`}>
                                Fish stock: {rundenErgebnis.alterFischbestand.toLocaleString()} → {rundenErgebnis.neuerFischbestand.toLocaleString()} ({rundenErgebnis.fischDelta > 0 ? '+' : ''}{rundenErgebnis.fischDelta.toLocaleString()})
                            </div>
                        </div>

                        {rundenErgebnis.neuerFischbestand < maxFischUI * 0.40 && (
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

            {/* Header */}
            <div className="flex-none flex justify-between items-center px-4 py-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <h1 className="text-base font-bold">Fish Banks Game</h1>
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

            {/* Tab bar */}
            <div className="flex-none flex border-b border-white/10 bg-blue-950/40">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-2 text-sm font-medium transition-colors border-b-2 ${
                            activeTab === tab.id
                                ? 'border-blue-400 text-white'
                                : 'border-transparent text-blue-400 hover:text-blue-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-y-auto">

                {/* ── Tab 1: Dashboard ──────────────────────────────────────────── */}
                {activeTab === 'dashboard' && (
                    <div className="p-3 flex flex-col gap-3 h-full">

                        {/* Net worth grid */}
                        <div className="grid grid-cols-2 gap-2">
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
                                        <div className="text-xs text-blue-200">Balance: {team.bankBalance.toLocaleString()}€</div>
                                        <div className="text-xs text-blue-200">Fleet: {team.fleet} ships × {marketShipPrice.toLocaleString()}€</div>
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

                        {/* Ship allocation + decision panel */}
                        {activeTeam ? (
                            <div className="flex-1 bg-white/10 rounded-xl p-3 flex flex-col gap-2">
                                <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                                    <h2 className="font-bold text-sm">{activeTeam.name} – Ship Allocation</h2>

                                    {(activeTeam.shipsInDelivery || 0) > 0 && (
                                        <div className="bg-green-500/15 border border-green-400/30 rounded-lg px-2.5 py-1.5 text-xs text-green-200">
                                            {activeTeam.shipsInDelivery} ship{activeTeam.shipsInDelivery !== 1 ? 's' : ''} arriving this round from last round's order
                                        </div>
                                    )}

                                    {/* Zone allocator */}
                                    <div className="bg-white/5 rounded-lg p-2.5">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-blue-200">Deploy {fleetSize} ships:</span>
                                            <span className={`text-xs font-bold ${allAllocated ? 'text-green-300' : 'text-yellow-300'}`}>
                                                {totalAllocated} / {fleetSize}
                                            </span>
                                        </div>
                                        {[
                                            { label: 'Harbor',   color: 'text-gray-300',   hint: '$50/ship · no catch',    val: currentHarbor,   set: setCurrentHarbor },
                                            { label: 'Coastal',  color: 'text-blue-300',   hint: '$150/ship · max 15/ship', val: currentCoastal,  set: setCurrentCoastal },
                                            { label: 'Deep Sea', color: 'text-yellow-300', hint: '$250/ship · max 25/ship', val: currentDeepSea,  set: setCurrentDeepSea },
                                        ].map(({ label, color, hint, val, set }) => (
                                            <div key={label} className="flex items-center gap-1.5 mb-1.5 last:mb-0">
                                                <span className={`text-xs w-16 ${color}`}>{label}</span>
                                                <button
                                                    onClick={() => set(Math.max(0, val - 1))}
                                                    disabled={val === 0}
                                                    className="bg-white/20 hover:bg-white/30 disabled:opacity-30 w-6 h-6 rounded-full font-bold text-sm flex items-center justify-center shrink-0"
                                                >−</button>
                                                <span className="w-5 text-center font-bold text-sm">{val}</span>
                                                <button
                                                    onClick={() => set(val + 1)}
                                                    disabled={allAllocated}
                                                    className="bg-white/20 hover:bg-white/30 disabled:opacity-30 w-6 h-6 rounded-full font-bold text-sm flex items-center justify-center shrink-0"
                                                >+</button>
                                                <span className={`text-xs ${color} opacity-70`}>{hint}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Zone Statistics table */}
                                    {(() => {
                                        const sqrtD      = Math.sqrt(Math.max(0, fishDichte))
                                        const fishPrice  = gameState.params?.fishPrice  ?? GAME_CONFIG.fischPreis
                                        const hCost      = gameState.params?.harborCost  ?? GAME_CONFIG.harborCost
                                        const cCost      = gameState.params?.coastalCost ?? GAME_CONFIG.coastalCost
                                        const dCost      = gameState.params?.deepSeaCost ?? GAME_CONFIG.deepSeaCost
                                        const cCatch     = 15 * sqrtD
                                        const dCatch     = 25 * sqrtD
                                        const cRev       = cCatch * fishPrice
                                        const dRev       = dCatch * fishPrice
                                        const hProfit    = -hCost
                                        const cProfit    = cRev - cCost
                                        const dProfit    = dRev - dCost
                                        const profitCls  = v => v >= 0 ? 'text-green-300' : 'text-red-300'
                                        const fmt        = v => v.toFixed(1)
                                        const rows = [
                                            { label: 'Expected Catch', h: '0',          c: `${fmt(cCatch)} fish`, d: `${fmt(dCatch)} fish` },
                                            { label: 'Fish Price',     h: `$${fishPrice}`, c: `$${fishPrice}`,     d: `$${fishPrice}` },
                                            { label: 'Revenue/Ship',   h: '$0',          c: `$${fmt(cRev)}`,       d: `$${fmt(dRev)}` },
                                            { label: 'Op Cost/Ship',   h: `$${hCost}`,   c: `$${cCost}`,           d: `$${dCost}` },
                                        ]
                                        return (
                                            <div className="bg-white/5 rounded-lg p-2.5">
                                                <div className="text-xs font-bold text-blue-200 mb-2">Zone Statistics (at current fish density)</div>
                                                <div className="grid grid-cols-4 gap-x-2 text-xs mb-1">
                                                    <div className="text-blue-400"></div>
                                                    <div className="font-medium text-gray-300 text-center">Harbor</div>
                                                    <div className="font-medium text-blue-300 text-center">Coastal</div>
                                                    <div className="font-medium text-yellow-300 text-center">Deep Sea</div>
                                                </div>
                                                {rows.map(row => (
                                                    <div key={row.label} className="grid grid-cols-4 gap-x-2 text-xs leading-5 border-t border-white/5">
                                                        <div className="text-blue-400">{row.label}</div>
                                                        <div className="text-center text-blue-100">{row.h}</div>
                                                        <div className="text-center text-blue-100">{row.c}</div>
                                                        <div className="text-center text-blue-100">{row.d}</div>
                                                    </div>
                                                ))}
                                                <div className="grid grid-cols-4 gap-x-2 text-xs leading-5 border-t border-white/10 mt-0.5 pt-0.5 font-bold">
                                                    <div className="text-blue-400">Profit/Ship</div>
                                                    <div className={`text-center ${profitCls(hProfit)}`}>−${hCost}</div>
                                                    <div className={`text-center ${profitCls(cProfit)}`}>{cProfit >= 0 ? '+' : ''}${fmt(cProfit)}</div>
                                                    <div className={`text-center ${profitCls(dProfit)}`}>{dProfit >= 0 ? '+' : ''}${fmt(dProfit)}</div>
                                                </div>
                                                <div className="text-xs text-blue-500 mt-1.5">Values based on current fish density: {fishPct}%</div>
                                            </div>
                                        )
                                    })()}

                                    {/* Sell + Order */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={handleBootVerkaufen}
                                            disabled={activeTeam.fleet <= 1}
                                            className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed font-bold py-2 rounded-xl transition-colors text-xs"
                                        >
                                            Sell Ship<br />
                                            <span className="font-normal">{marketShipPrice.toLocaleString()}€ (instant)</span>
                                        </button>
                                        <div className="bg-blue-500/20 border border-blue-400/20 rounded-xl px-2.5 py-2">
                                            <div className="text-xs font-bold text-blue-200 mb-0.5">Order New Ships</div>
                                            <div className="text-xs text-blue-400 mb-1.5">{newShipPriceUI.toLocaleString()}€ each · next round · max: {maxShipOrder}</div>
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {Array.from({ length: maxShipOrder + 1 }, (_, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => setCurrentShipsOrdered(i)}
                                                        className={`min-w-[1.75rem] h-7 rounded px-1 font-bold text-sm transition-colors ${
                                                            safeShipsOrdered === i
                                                                ? 'bg-blue-500 text-white'
                                                                : 'bg-white/20 hover:bg-white/30 text-white'
                                                        }`}
                                                    >{i}</button>
                                                ))}
                                                {safeShipsOrdered > 0 && (
                                                    <span className="text-xs text-blue-300 ml-0.5">−{(safeShipsOrdered * newShipPriceUI).toLocaleString()}€</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Auction offer */}
                                    {activeTeam.fleet > 1 && (
                                        <div className="bg-yellow-500/10 border border-yellow-400/20 rounded-lg px-3 py-2">
                                            <div className="text-xs text-yellow-300 font-bold mb-1">Offer Ships at Auction</div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setCurrentBoatsOffered(Math.max(0, currentBoatsOffered - 1))} className="bg-white/20 hover:bg-white/30 w-7 h-7 rounded-full font-bold text-sm flex items-center justify-center shrink-0">−</button>
                                                <div className="text-lg font-bold w-7 text-center">{currentBoatsOffered}</div>
                                                <button onClick={() => setCurrentBoatsOffered(Math.min(activeTeam.fleet - 1, currentBoatsOffered + 1))} className="bg-white/20 hover:bg-white/30 w-7 h-7 rounded-full font-bold text-sm flex items-center justify-center shrink-0">+</button>
                                                <div className="text-xs text-blue-300">min. 150€ starting bid</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-none flex flex-col gap-1.5">
                                    {import.meta.env.DEV && (
                                        <button onClick={handleDevSkip} className="w-full bg-purple-600 hover:bg-purple-500 font-bold py-1.5 rounded-xl transition-colors text-xs">
                                            DEV: Simulate Game
                                        </button>
                                    )}
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!allAllocated}
                                        className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-2.5 rounded-xl text-sm transition-colors"
                                    >
                                        {allAllocated ? 'Confirm Round' : `Allocate all ${fleetSize} ships first`}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 bg-white/10 rounded-xl p-3 flex items-center justify-center">
                                <p className="text-blue-300 text-center text-xs">All decisions submitted.<br />Processing round…</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Tab 2: Reports ────────────────────────────────────────────── */}
                {activeTab === 'reports' && (
                    <div className="p-3 flex flex-col gap-3">

                        {/* Fish stock bar */}
                        <div className={`bg-white/10 rounded-xl px-3 py-2 ${fishDichte <= 0.30 ? 'pulse-critical' : ''}`}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-sm">Fish Stock</span>
                                {showFishStock
                                    ? <span className="font-bold text-sm">{gameState.fischbestand.toLocaleString()} / {maxFischUI.toLocaleString()}</span>
                                    : <span className="font-bold text-sm text-blue-400">Hidden by instructor</span>
                                }
                            </div>
                            <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden mb-1">
                                <div
                                    className="h-2.5 rounded-full fish-bar-transition"
                                    style={{
                                        width: showFishStock ? `${fishPct}%` : '100%',
                                        backgroundColor: showFishStock
                                            ? (fishDichte > 0.60 ? '#22c55e' : fishDichte > 0.30 ? '#f59e0b' : '#ef4444')
                                            : '#3b82f6'
                                    }}
                                />
                            </div>
                            <div className={`text-xs ${showFishStock ? (fishDichte > 0.60 ? 'text-green-300' : fishDichte > 0.30 ? 'text-yellow-300' : 'text-red-300') : 'text-blue-400'}`}>
                                {showFishStock ? (fishDichte > 0.60 ? 'Healthy' : fishDichte > 0.30 ? 'Endangered' : 'Critical!') : 'Observe catch rates to estimate stock'}
                            </div>
                        </div>

                        {/* Fish stock graph */}
                        <div className="bg-white/10 rounded-xl p-2" style={{ height: 220 }}>
                            <FishGraph verlauf={gameState.verlauf} />
                        </div>

                        {/* Annual report — last round summary per team */}
                        {gameState.runde > 1 && (
                            <div className="bg-white/10 rounded-xl p-3">
                                <h3 className="font-bold text-sm mb-2">Annual Report – Round {gameState.runde - 1}</h3>
                                <div className="space-y-2">
                                    {(showOtherCatches ? gameState.teams : gameState.teams.filter(t => !t.istKI)).map(team => {
                                        const s = team.roundSummary
                                        if (!s) return null
                                        return (
                                            <div key={team.name} className="bg-white/5 rounded-lg p-2.5">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold text-xs">{team.farbe} {team.name} {team.istKI ? '🤖' : ''}</span>
                                                    <span className="text-xs text-blue-300">{s.fang} fish | {s.fishRevenue.toLocaleString()}€ revenue</span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-x-2 text-xs text-blue-200 leading-relaxed">
                                                    <div>Harbor ({s.harborShips}): −{(s.harborShips * (gameState.params?.harborCost ?? GAME_CONFIG.harborCost)).toLocaleString()}€</div>
                                                    <div>Coastal ({s.coastalShips}): {s.coastalFang} fish</div>
                                                    <div>Deep Sea ({s.deepSeaShips}): {s.deepSeaFang} fish</div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-2 text-xs mt-1 leading-relaxed">
                                                    <div className="text-blue-200">Op costs: <span className="text-red-300">−{s.opCosts.toLocaleString()}€</span></div>
                                                    <div className="text-blue-200">Interest: <span className={s.zinsen >= 0 ? 'text-green-300' : 'text-red-300'}>{s.zinsen >= 0 ? '+' : ''}{s.zinsen.toLocaleString()}€</span></div>
                                                    <div className="text-blue-200">Orders: <span className="text-red-300">−{s.orderCost.toLocaleString()}€</span></div>
                                                    <div className="font-bold">Final: {s.finalBalance.toLocaleString()}€</div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Tab 3: Market ─────────────────────────────────────────────── */}
                {activeTab === 'market' && (
                    <div className="p-3 flex flex-col gap-3">

                        {/* Ship market summary */}
                        <div className="bg-white/10 rounded-xl p-3">
                            <h3 className="font-bold text-sm mb-2">Ship Market</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-white/5 rounded-lg p-2.5">
                                    <div className="text-xs text-blue-300 mb-0.5">Current market price</div>
                                    <div className="text-xl font-bold text-yellow-300">{marketShipPrice.toLocaleString()}€</div>
                                    <div className="text-xs text-blue-400 mt-0.5">sell instantly via "Sell Ship" in Dashboard</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-2.5">
                                    <div className="text-xs text-blue-300 mb-0.5">New ship (shipyard)</div>
                                    <div className="text-xl font-bold text-blue-300">{newShipPriceUI.toLocaleString()}€</div>
                                    <div className="text-xs text-blue-400 mt-0.5">ordered in Dashboard · arrives next round</div>
                                </div>
                            </div>
                        </div>

                        {/* Fleet overview */}
                        <div className="bg-white/10 rounded-xl p-3">
                            <h3 className="font-bold text-sm mb-2">Fleet Overview</h3>
                            <div className="space-y-1.5">
                                {gameState.teams.map(team => {
                                    const fleetValue = team.fleet * marketShipPrice
                                    return (
                                        <div key={team.name} className="flex justify-between items-center text-xs bg-white/5 rounded-lg px-3 py-1.5">
                                            <span className="font-bold">{team.farbe} {team.name} {team.istKI ? '🤖' : ''}</span>
                                            <span className="text-blue-200">{team.fleet} ships</span>
                                            <span className="text-yellow-300">{fleetValue.toLocaleString()}€</span>
                                            <span className="text-white font-bold">NW: {team.netWorth.toLocaleString()}€</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Auction history */}
                        <div className="bg-white/10 rounded-xl p-3">
                            <h3 className="font-bold text-sm mb-2">Auction History</h3>
                            {(gameState.auctionHistory || []).length === 0 ? (
                                <p className="text-xs text-blue-400">No auction sales yet.</p>
                            ) : (
                                <div className="space-y-1">
                                    {[...(gameState.auctionHistory || [])].reverse().map((ev, i) => (
                                        <div key={i} className="flex justify-between text-xs bg-white/5 rounded px-2.5 py-1">
                                            <span className="text-blue-300">Round {ev.runde}</span>
                                            <span className="text-white">1 ship → {ev.kaeufer}</span>
                                            <span className="text-yellow-300">{ev.preis.toLocaleString()}€</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}

export default GamePage
