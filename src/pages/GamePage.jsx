import FishGraph from '../components/FishGraph'
import { useState } from 'react'
import {
    GAME_CONFIG, berechneFischbestand, berechneNetWorth,
    kiBootAktionLeicht, kiAusgesandtLeicht,
    kiBootAktionSchwer, kiAusgesandtSchwer,
    erzeugeMarktereignis, kiZoneAllokierung,
} from '../game/fishLogic'

// ─── MIT Order Verification Test (DEV only) ───────────────────────────────────
// Scenario: team starts with $5000, buys 1 ship at auction ($500) → balance $4500, fleet 4
// Fleet of 4 ships (0 in harbor, rest coastal/deep sea); all 4 pay operating costs (MIT: all zones)
// Step 3: op costs  4 ships × $75 = $300  → balance $4200, min $4200
// Step 4: fish      50 fish × $20 = $1000 → balance $5200, min stays $4200
// Step 5: interest  $4200 × 2%   = $84   → balance $5284
// Step 6: orders    2 ships × $300 = $600  → balance $4684, shipsInDelivery = 2
// Next round: fleet = 4 + 2 = 6
if (import.meta.env.DEV) {
    ;(function verifyMITOrder() {
        const startBalance = 4500   // after buying 1 ship at auction ($5000 − $500)
        const fleet = 4             // 3 original + 1 bought at auction
        const deployedShips = 4     // fleet size = 4; all pay operating costs (none in harbor here)
        const fang = 50
        const shipsOrdered = 2

        let balance = startBalance
        let minBalance = balance

        const opCosts = deployedShips * GAME_CONFIG.betriebskosten   // all ships in fleet
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
        console.log('[MIT Order Test — Positive]')
        console.log(`  Start balance (after auction buy): ${startBalance}€  ← $5000 − $500`)
        console.log(`  Op costs (${deployedShips} ships × ${GAME_CONFIG.betriebskosten}€): −${opCosts}€  → balance ${4500 - opCosts}€`)
        console.log(`  Fish revenue (${fang} × ${GAME_CONFIG.fischPreis}€): +${fishRevenue}€  → balance ${4500 - opCosts + fishRevenue}€`)
        console.log(`  Minimum balance: ${minBalance}€  (reached after op costs)`)
        console.log(`  Interest (${minBalance} × 2%): +${zinsen}€  → balance ${4500 - opCosts + fishRevenue + zinsen}€`)
        console.log(`  Ship orders (${actualOrder} × ${GAME_CONFIG.bootKosten}€): −${orderCost}€  → balance ${balance}€`)
        console.log(`  Max order (ceil(${fleet}/2)): ${maxOrder}  |  Actual order: ${actualOrder}`)
        console.log(`  Ships in delivery: ${actualOrder}  → fleet next round: ${fleet + actualOrder}`)
        console.log(`  ${pass ? 'PASS ✅' : 'FAIL ❌'}  expected: opCosts=300, minBalance=4200, interest=+84, finalBalance=4684, fleet→6`)

        // Negative balance test
        // Start: $200, buy 1 ship at $500 → startBalance −$300
        // Step 3: 4×$75 → −$600 (min), Step 4: 20×$20 → −$200, Step 5: −$600×2% = −$12 → −$212
        ;(function verifyNegativeBalance() {
            let nb = -300   // balance after auction buy
            let nbMin = nb
            const nbOpCosts = 4 * GAME_CONFIG.betriebskosten   // $300
            nb -= nbOpCosts
            nbMin = Math.min(nbMin, nb)   // −600
            nb += 20 * GAME_CONFIG.fischPreis   // +400 → −200
            nbMin = Math.min(nbMin, nb)   // stays −600
            const nbZinsen = Math.round(nbMin * GAME_CONFIG.zinsRate)   // −12
            nb += nbZinsen   // −212
            const nbPass = nbMin === -600 && nbZinsen === -12 && nb === -212
            console.log('[MIT Order Test — Negative Balance]')
            console.log(`  Start balance (after auction buy): −300€`)
            console.log(`  Op costs (4 × 75€): −300€  → balance −600€, min −600€`)
            console.log(`  Fish revenue (20 × 20€): +400€  → balance −200€, min stays −600€`)
            console.log(`  Interest (−600 × 2%): ${nbZinsen}€  → balance ${nb}€`)
            console.log(`  ${nbPass ? 'PASS ✅' : 'FAIL ❌'}  expected: minBalance=−600, interest=−12, finalBalance=−212`)
        })()
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
    const opCostPerShip = params?.operatingCostPerShip ?? GAME_CONFIG.betriebskosten
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

        // Step 3: Operating costs — ALL ships in fleet (Harbor, Coastal, Deep Sea per MIT spec)
        const deployedShips = team.fleet
        const opCosts = deployedShips * opCostPerShip
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
            console.log(`  [${team.name}] Step 3 - After operating costs: ${(startBalance - opCosts).toLocaleString()}€  (−${opCosts}€, ${deployedShips} ships in fleet)`)
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
                                            <div>Op costs ({s.deployedShips} deployed): <span className="text-red-300">−{s.opCosts.toLocaleString()}€</span></div>
                                            <div>Fish sales: <span className="text-green-300">+{s.fishRevenue.toLocaleString()}€</span></div>
                                            <div>Minimum balance this round: <span className="text-yellow-300">{s.minBalance.toLocaleString()}€</span></div>
                                            <div>{s.zinsen >= 0 ? 'Interest earned:' : 'Interest charged:'} <span className={s.zinsen >= 0 ? 'text-green-300' : 'text-red-300'}>{s.zinsen >= 0 ? '+' : ''}{s.zinsen.toLocaleString()}€</span></div>
                                            <div>Ship orders ({s.actualOrder} × {(s.newShipPrice ?? newShipPriceUI).toLocaleString()}€): <span className="text-red-300">−{s.orderCost.toLocaleString()}€</span></div>
                                        </div>
                                        <div className="mt-1 pt-1 border-t border-white/10 grid grid-cols-3 gap-x-2 text-xs text-blue-300 leading-relaxed">
                                            <div>Coastal ({s.coastalShips}): {s.coastalFang} fish</div>
                                            <div>Deep Sea ({s.deepSeaShips}): {s.deepSeaFang} fish</div>
                                            <div>Harbor ({s.harborShips}): resting</div>
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

                        {/* Catch summary + fish stock */}
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
                        const dichte = gameState.fischbestand / maxFischUI
                        const pct = Math.round(dichte * 100)
                        return (
                            <div className={`flex-none bg-white/10 rounded-xl px-3 py-2 ${dichte <= 0.30 ? 'pulse-critical' : ''}`}>
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
                                            width: showFishStock ? `${pct}%` : '100%',
                                            backgroundColor: showFishStock
                                                ? (dichte > 0.60 ? '#22c55e' : dichte > 0.30 ? '#f59e0b' : '#ef4444')
                                                : '#3b82f6'
                                        }}
                                    />
                                </div>
                                <div className={`text-xs ${showFishStock ? (dichte > 0.60 ? 'text-green-300' : dichte > 0.30 ? 'text-yellow-300' : 'text-red-300') : 'text-blue-400'}`}>
                                    {showFishStock ? (dichte > 0.60 ? 'Healthy' : dichte > 0.30 ? 'Endangered' : 'Critical!') : 'Observe catch rates to estimate stock'}
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
                                    <div className="text-xs text-blue-200">Balance: {team.bankBalance.toLocaleString()}€</div>
                                    <div className="text-xs text-blue-200">Fleet: {(team.fleet * marketShipPrice).toLocaleString()}€ ({team.fleet} ships)</div>
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
                                </div>

                                {/* Ship delivery notice */}
                                {(activeTeam.shipsInDelivery || 0) > 0 && (
                                    <div className="bg-green-500/15 border border-green-400/30 rounded-lg px-2.5 py-1.5 text-xs text-green-200">
                                        {activeTeam.shipsInDelivery} ship{activeTeam.shipsInDelivery !== 1 ? 's' : ''} arriving this round from last round's order
                                    </div>
                                )}

                                {/* Zone deployment allocator */}
                                <div className="bg-white/5 rounded-lg p-2.5">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-xs font-bold text-blue-200">Deploy {fleetSize} ships:</span>
                                        <span className={`text-xs font-bold ${allAllocated ? 'text-green-300' : 'text-yellow-300'}`}>
                                            {totalAllocated} / {fleetSize}
                                        </span>
                                    </div>
                                    {/* Harbor */}
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <span className="text-xs w-16 text-blue-300">Harbor</span>
                                        <button
                                            onClick={() => setCurrentHarbor(Math.max(0, currentHarbor - 1))}
                                            disabled={currentHarbor === 0}
                                            className="bg-white/20 hover:bg-white/30 disabled:opacity-30 w-6 h-6 rounded-full font-bold text-sm flex items-center justify-center shrink-0"
                                        >−</button>
                                        <span className="w-5 text-center font-bold text-sm">{currentHarbor}</span>
                                        <button
                                            onClick={() => setCurrentHarbor(currentHarbor + 1)}
                                            disabled={allAllocated}
                                            className="bg-white/20 hover:bg-white/30 disabled:opacity-30 w-6 h-6 rounded-full font-bold text-sm flex items-center justify-center shrink-0"
                                        >+</button>
                                        <span className="text-xs text-gray-400">no cost, no catch</span>
                                    </div>
                                    {/* Coastal */}
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <span className="text-xs w-16 text-blue-300">Coastal</span>
                                        <button
                                            onClick={() => setCurrentCoastal(Math.max(0, currentCoastal - 1))}
                                            disabled={currentCoastal === 0}
                                            className="bg-white/20 hover:bg-white/30 disabled:opacity-30 w-6 h-6 rounded-full font-bold text-sm flex items-center justify-center shrink-0"
                                        >−</button>
                                        <span className="w-5 text-center font-bold text-sm">{currentCoastal}</span>
                                        <button
                                            onClick={() => setCurrentCoastal(currentCoastal + 1)}
                                            disabled={allAllocated}
                                            className="bg-white/20 hover:bg-white/30 disabled:opacity-30 w-6 h-6 rounded-full font-bold text-sm flex items-center justify-center shrink-0"
                                        >+</button>
                                        <span className="text-xs text-blue-300">max 15 fish/ship</span>
                                    </div>
                                    {/* Deep Sea */}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs w-16 text-yellow-300">Deep Sea</span>
                                        <button
                                            onClick={() => setCurrentDeepSea(Math.max(0, currentDeepSea - 1))}
                                            disabled={currentDeepSea === 0}
                                            className="bg-white/20 hover:bg-white/30 disabled:opacity-30 w-6 h-6 rounded-full font-bold text-sm flex items-center justify-center shrink-0"
                                        >−</button>
                                        <span className="w-5 text-center font-bold text-sm">{currentDeepSea}</span>
                                        <button
                                            onClick={() => setCurrentDeepSea(currentDeepSea + 1)}
                                            disabled={allAllocated}
                                            className="bg-white/20 hover:bg-white/30 disabled:opacity-30 w-6 h-6 rounded-full font-bold text-sm flex items-center justify-center shrink-0"
                                        >+</button>
                                        <span className="text-xs text-yellow-300">max 25 fish/ship</span>
                                    </div>
                                </div>

                                {/* Sell ship (instant auction sale) + New ship order */}
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={handleBootVerkaufen}
                                        disabled={activeTeam.fleet <= 1}
                                        className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed font-bold py-2 rounded-xl transition-colors text-xs"
                                    >
                                        Sell Ship<br />
                                        <span className="font-normal">{marketShipPrice.toLocaleString()}€ (instant)</span>
                                    </button>

                                    {/* New ship order: paid after income, delivered next round (MIT Step 6) */}
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

                                {/* Auction: offer ships to AI bidders */}
                                {activeTeam.fleet > 1 && (
                                    <div className="bg-yellow-500/10 border border-yellow-400/20 rounded-lg px-3 py-2">
                                        <div className="text-xs text-yellow-300 font-bold mb-1">Offer Ships at Auction</div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setCurrentBoatsOffered(Math.max(0, currentBoatsOffered - 1))}
                                                className="bg-white/20 hover:bg-white/30 w-7 h-7 rounded-full font-bold text-sm flex items-center justify-center shrink-0"
                                            >−</button>
                                            <div className="text-lg font-bold w-7 text-center">{currentBoatsOffered}</div>
                                            <button
                                                onClick={() => setCurrentBoatsOffered(Math.min(activeTeam.fleet - 1, currentBoatsOffered + 1))}
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
