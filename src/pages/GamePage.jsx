import FishGraph from '../components/FishGraph'
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useState, useEffect, useRef } from 'react'
import {
    GAME_CONFIG, berechneFischbestand, berechneNetWorth,
    kiDecisionEasy, kiDecisionHard,
    erzeugeMarktereignis,
} from '../game/fishLogic'
import { teamHex } from '../game/teamColors'
import {
    IconAlertTriangle, IconCheck, IconClipboard, IconFish, IconFishingRod,
    IconGavel, IconHourglass, IconNewspaper, IconPlug, IconRobot, IconShip,
    IconTag, IconTrophy,
} from '../components/icons'

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

function aktualisiereMarktpreis(aktuellPreis, alleTeams, listingEvents = []) {
    const successfulSales = listingEvents.filter(e => e.erfolg)
    if (successfulSales.length > 0) {
        const totalRevenue   = successfulSales.reduce((s, e) => s + e.preis * (e.ships || 1), 0)
        const totalShipsSold = successfulSales.reduce((s, e) => s + (e.ships || 1), 0)
        const avgPrice = totalRevenue / totalShipsSold
        return Math.max(150, Math.min(1500, Math.round((aktuellPreis * 0.4 + avgPrice * 0.6) / 10) * 10))
    }
    const totalBoote = alleTeams.reduce((sum, t) => sum + t.fleet, 0)
    let neuerPreis = aktuellPreis
    if (totalBoote > 15) neuerPreis *= 0.95
    else if (totalBoote < 9) neuerPreis *= 1.05
    return Math.max(150, Math.min(1500, Math.round(neuerPreis / 10) * 10))
}

function kiMaxGebot(team, fischbestand, marketShipPrice) {
    // Hard AI bids up to 10% over market; Easy AI bids up to market price.
    const maxBid = team.aiDifficulty === 'hard'
        ? Math.round(marketShipPrice * 1.1)
        : marketShipPrice
    return Math.min(maxBid, team.bankBalance)
}

// humanBids: { [buyerSlotIdx]: bidAmount } — optional human player bids
function loeseAuktion(teams, sellerIdx, anzahlAngebote, fischbestand, marketShipPrice, humanBids = {}) {
    if (anzahlAngebote === 0) return { teams, auctionEvents: [] }
    let t = teams.map(x => ({ ...x }))
    const auctionEvents = []
    for (let i = 0; i < anzahlAngebote; i++) {
        if (t[sellerIdx].fleet <= 1) break
        let bestBid = 149
        let bestBidderIdx = -1
        t.forEach((team, idx) => {
            if (idx === sellerIdx) return
            let gebot = 0
            if (team.istKI) {
                gebot = kiMaxGebot(team, fischbestand, marketShipPrice)
            } else {
                gebot = humanBids[idx] || 0
            }
            if (gebot > bestBid && team.bankBalance >= gebot) { bestBid = gebot; bestBidderIdx = idx }
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

// Calls the appropriate AI decision function, then applies instant buy/sell to fleet and balance.
// Returns updated fleet, bankBalance, zone allocation, and aiNewShipOrders for Step 6.
function kiTeamAktionen(team, gameState, params) {
    const decision = team.aiDifficulty === 'hard'
        ? kiDecisionHard(team, gameState, params)
        : kiDecisionEasy(team, gameState, params)

    let fleet = team.fleet
    let bankBalance = team.bankBalance
    const auctionPrice = gameState.marketShipPrice ?? GAME_CONFIG.auctionPreis

    // Auction sell — goes to pending offers, resolved next round by all bidders
    let shipsToAuction = 0
    if (decision.shipsToSell > 0 && fleet > 1) {
        shipsToAuction = Math.min(decision.shipsToSell, fleet - 1)
        // Fleet and balance unchanged until auction resolves next round
    }

    // Instant buy (AI buys at current market price)
    if (decision.shipsToBuy > 0 && bankBalance >= decision.shipsToBuy * auctionPrice) {
        fleet += decision.shipsToBuy
        bankBalance -= decision.shipsToBuy * auctionPrice
    }

    const { harborShips, coastalShips, deepSeaShips } = decision
    return {
        fleet,
        bankBalance,
        harborShips,
        coastalShips,
        deepSeaShips,
        ausgesandteBoote: coastalShips + deepSeaShips,
        aiNewShipOrders: decision.newShipOrders,
        shipsToAuction,
    }
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
        return { ...team, fleet: team.fleet + delivered, shipsInDelivery: 0, auctionPurchases: 0, instantBuyCount: 0, instantSellCount: 0 }
    })

    if (import.meta.env.DEV) {
        console.log(`\n=== ROUND ${state.runde} PROCESSING ===`)
        if (roundDeliveries.length > 0)
            roundDeliveries.forEach(d => console.log(`  Step 1 - Ships delivered to ${d.name}: +${d.count}`))
        else
            console.log('  Step 1 - No ship deliveries')
    }

    // ── Step 1b: Resolve pending auction offers from previous round ──
    const prevPendingOffers = state.pendingAuctionOffers || []
    let teamsAfterPending = teamsNachLieferung.map(t => ({ ...t }))
    let pendingAuctionEvents = []
    for (const offer of prevPendingOffers) {
        if ((teamsAfterPending[offer.sellerIdx]?.fleet ?? 0) <= 1) continue
        const humanBids = {}
        Object.entries(humanDecisions).forEach(([idxStr, d]) => {
            const bid = d.auctionBids?.[offer.id]
            if (bid > 0) humanBids[parseInt(idxStr)] = bid
        })
        const { teams: updated, auctionEvents } = loeseAuktion(
            teamsAfterPending, offer.sellerIdx, offer.count, state.fischbestand, marketShipPrice, humanBids
        )
        teamsAfterPending = updated
        pendingAuctionEvents = pendingAuctionEvents.concat(auctionEvents)
    }

    // ── Step 1c: Resolve auction listings from previous round ──
    const listingAuctionEvents = []
    let teamsAfterListings = teamsAfterPending.map(t => ({ ...t }))
    const fishDensityForBids = maxFisch > 0 ? state.fischbestand / maxFisch : 0

    for (const listing of (state.auctionListings || [])) {
        const allBids = { ...(listing.bids || {}) }
        teamsAfterListings.forEach((team, idx) => {
            if (idx === listing.sellerSlot) return
            if (team.istKI && team.aiDifficulty === 'hard' && fishDensityForBids > 0.60) {
                const aiBid = Math.round(Math.min(marketShipPrice * 1.15, team.bankBalance))
                if (aiBid > 0 && (allBids[idx] == null || allBids[idx] < aiBid)) allBids[idx] = aiBid
            }
        })
        let bestBid = listing.askingPrice - 1
        let bestBidderIdx = -1
        Object.entries(allBids).forEach(([idxStr, bid]) => {
            const idx = parseInt(idxStr)
            if (idx === listing.sellerSlot) return
            if (bid >= listing.askingPrice && bid > bestBid && (teamsAfterListings[idx]?.bankBalance ?? 0) >= bid) {
                bestBid = bid; bestBidderIdx = idx
            }
        })
        if (bestBidderIdx >= 0) {
            teamsAfterListings = teamsAfterListings.map((t, idx) => {
                if (idx === listing.sellerSlot) return { ...t, bankBalance: t.bankBalance + bestBid }
                if (idx === bestBidderIdx) return { ...t, fleet: t.fleet + listing.ships, bankBalance: t.bankBalance - bestBid }
                return t
            })
            listingAuctionEvents.push({ erfolg: true, sellerName: listing.sellerName, kaeufer: teamsAfterListings[bestBidderIdx].name, preis: bestBid, ships: listing.ships })
        } else {
            teamsAfterListings = teamsAfterListings.map((t, idx) => {
                if (idx === listing.sellerSlot) return { ...t, fleet: t.fleet + listing.ships }
                return t
            })
            listingAuctionEvents.push({ erfolg: false, sellerName: listing.sellerName, ships: listing.ships })
        }
    }

    // ── Step 2: Fleet decisions (AI buy/sell + human pre-round sells already applied) ──
    const teamsNachEntscheidung = teamsAfterListings.map((team, index) => {
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
        const stateForAI = { ...state, teams: teamsAfterListings, marketShipPrice }
        return { ...team, ...kiTeamAktionen(team, stateForAI, params) }
    })

    // Detect AI ship purchases this round (fleet grew vs. post-pending-resolution fleet)
    const aiShipPurchases = []
    teamsNachEntscheidung.forEach((t, i) => {
        if (t.istKI && t.fleet > teamsAfterPending[i].fleet) {
            aiShipPurchases.push({ name: t.name, farbe: t.farbe, count: t.fleet - teamsAfterPending[i].fleet, price: marketShipPrice })
        }
    })

    // Collect new AI auction offers (pending for next round); skip if seller already has a pending offer
    const existingPendingSellerIdxs = new Set(prevPendingOffers.map(o => o.sellerIdx))
    const newPendingAuctionOffers = []
    teamsNachEntscheidung.forEach((t, i) => {
        if (t.istKI && (t.shipsToAuction || 0) > 0 && !existingPendingSellerIdxs.has(i)) {
            newPendingAuctionOffers.push({
                id: `ai-${i}-${state.runde}`,
                sellerIdx: i,
                sellerName: t.name,
                sellerFarbe: t.farbe,
                count: t.shipsToAuction,
            })
        }
    })

    // ── AI market listings (ships removed from fleet immediately, resolved next round) ──
    const aiNewListings = []
    const fishDensityForAI = maxFisch > 0 ? state.fischbestand / maxFisch : 0
    let teamsWithAIListings = teamsNachEntscheidung.map(t => ({ ...t }))
    teamsNachEntscheidung.forEach((team, idx) => {
        if (!team.istKI || teamsWithAIListings[idx].fleet <= 2) return
        if (aiNewListings.some(l => l.sellerSlot === idx)) return
        let askingPrice = null
        if (team.aiDifficulty === 'easy' && fishDensityForAI < 0.35) {
            askingPrice = Math.round(marketShipPrice * 0.9)
        } else if (team.aiDifficulty === 'hard' && fishDensityForAI < 0.40) {
            askingPrice = Math.round(marketShipPrice * 0.85)
        }
        if (askingPrice !== null) {
            aiNewListings.push({ id: `al-${idx}-${state.runde}`, sellerSlot: idx, sellerName: team.name, sellerFarbe: team.farbe, ships: 1, askingPrice, bids: {} })
            teamsWithAIListings[idx] = { ...teamsWithAIListings[idx], fleet: teamsWithAIListings[idx].fleet - 1 }
        }
    })

    // ── Step 2 continued: Auction — resolve human ship offers (H→H and H→AI) ──
    let allAuctionEvents = [...pendingAuctionEvents]
    let teamsNachStep2 = [...teamsWithAIListings]
    for (const [idxStr, decision] of Object.entries(humanDecisions)) {
        const idx = parseInt(idxStr)
        if ((decision.boatsOffered || 0) > 0) {
            const maxOffer = Math.min(decision.boatsOffered, Math.max(0, teamsNachStep2[idx].fleet - 1))
            // Collect human bids on this same-round offer (keyed as `h-${sellerSlotIdx}`)
            const humanBids = {}
            Object.entries(humanDecisions).forEach(([bidderIdxStr, d]) => {
                const bidderIdx = parseInt(bidderIdxStr)
                if (bidderIdx === idx) return
                const bid = d.auctionBids?.[`h-${idx}`]
                if (bid > 0) humanBids[bidderIdx] = bid
            })
            const { teams: updated, auctionEvents } = loeseAuktion(teamsNachStep2, idx, maxOffer, state.fischbestand, marketShipPrice, humanBids)
            teamsNachStep2 = updated
            allAuctionEvents = [...allAuctionEvents, ...auctionEvents]
        }
    }

    // ONE weather roll per round — same value used for all teams (MIT spec)
    const wetterfaktor = erzeugeMarktereignis()

    // ── Fish catch: per-team zone calculation with weather factor ──
    // Formula: teamCatch = (coastalShips × 15 + deepSeaShips × 25) × sqrt(density) × weatherFactor
    const dichte = state.fischbestand / maxFisch
    const sqrtDichte = Math.sqrt(Math.max(0, dichte))
    const teamCatches = teamsNachStep2.map(t => {
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
    let teamsNachRunde = teamsNachStep2.map((team, index) => {
        const shipsOrdered = !team.istKI ? (humanDecisions[index]?.shipsOrdered || 0) : (team.aiNewShipOrders || 0)

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

    const neuerMarktpreis = aktualisiereMarktpreis(marketShipPrice, teamsNachRunde, listingAuctionEvents)
    const finalTeams = teamsNachRunde.map(team => ({
        ...team,
        netWorth: berechneNetWorth(team.bankBalance, team.fleet, neuerMarktpreis),
    }))

    if (import.meta.env.DEV) {
        console.log(`  Step 7 - Fish stock: ${state.fischbestand.toLocaleString()} → ${neuerFischbestand.toLocaleString()}  (total catch: ${gesamtFang}, weather: ${wetterfaktor.toFixed(2)}×)`)
        finalTeams.forEach(t => console.log(`  Step 8 - Net Worth [${t.name}]: ${t.netWorth.toLocaleString()}€  (${t.bankBalance.toLocaleString()}€ + ${t.fleet} ships × ${neuerMarktpreis}€)`))
        console.log('=== END ROUND ===')
    }

    const finalFischbestand = Math.max(0, neuerFischbestand)
    const verlaufEintrag = { runde: state.runde, fischbestand: state.fischbestand, gesamtFang, wetterfaktor, wachstum: finalFischbestand - state.fischbestand + gesamtFang, marketShipPrice: neuerMarktpreis }
    finalTeams.forEach(team => {
        verlaufEintrag[team.name] = team.netWorth
        verlaufEintrag[`${team.name}_rs`] = team.roundSummary
    })

    const neueAuctionHistory = allAuctionEvents.some(e => e.erfolg)
        ? [...(state.auctionHistory || []), ...allAuctionEvents.filter(e => e.erfolg).map(e => ({ runde: state.runde, ...e }))]
        : (state.auctionHistory || [])
    return {
        ...state,
        runde: state.runde + 1,
        fischbestand: finalFischbestand,
        marketShipPrice: neuerMarktpreis,
        teams: finalTeams,
        verlauf: [...state.verlauf, verlaufEintrag],
        auctionHistory: neueAuctionHistory,
        letzteAuktionEvents: allAuctionEvents,
        pendingAuctionOffers: newPendingAuctionOffers,
        roundDeliveries,
        letzterWetterfaktor: wetterfaktor,
        letzterGesamtFang: gesamtFang,
        aiShipPurchases,
        auctionListings: aiNewListings,
        letzteListingEvents: listingAuctionEvents,
        phase: (state.runde >= maxRunden || finalFischbestand <= 0) ? 'ende' : 'entscheidung',
    }
}

// ─── AuctionListingCard ───────────────────────────────────────────────────────

function AuctionListingCard({ listing, mySlotIndex, socket, roomCode }) {
    const [timeLeft, setTimeLeft] = useState(null)
    const [bidInput, setBidInput] = useState('')

    useEffect(() => {
        if (!listing.timerEndsAt || listing.status !== 'open') { setTimeLeft(null); return }
        const update = () => setTimeLeft(Math.max(0, listing.timerEndsAt - Date.now()))
        update()
        const iv = setInterval(update, 100)
        return () => clearInterval(iv)
    }, [listing.timerEndsAt, listing.status])

    const isSeller  = listing.sellerSlot === mySlotIndex
    const isWinning = listing.topBidderSlot === mySlotIndex
    const hasBid    = listing.topBid != null
    const isPassed  = (listing.passedBy || []).includes(mySlotIndex)
    const secLeft   = timeLeft != null ? Math.ceil(timeLeft / 1000) : null
    const minNext   = (listing.topBid != null ? listing.topBid : listing.askingPrice - 1) + 1

    function placeBid() {
        const amount = parseInt(bidInput) || 0
        if (amount < listing.askingPrice || amount <= (listing.topBid ?? 0)) return
        socket.emit('place-bid', { roomCode, listingId: listing.id, amount })
        setBidInput('')
    }

    if (listing.status === 'sold') {
        return (
            <div className="bg-green-900/30 border border-green-400/30 rounded-lg p-3">
                <div className="text-xs text-blue-300 mb-1 flex items-center gap-1.5">
                    <TeamDot farbe={listing.sellerFarbe} />{listing.sellerName} — {listing.ships} ship{listing.ships !== 1 ? 's' : ''} @ {listing.askingPrice.toLocaleString()}€
                </div>
                <div className="text-sm font-bold text-green-300 flex items-center gap-1.5">
                    <IconCheck className="w-3.5 h-3.5" /> Sold to {listing.resolution?.buyerName} for {listing.resolution?.price.toLocaleString()}€
                </div>
            </div>
        )
    }

    if (listing.status === 'returned') {
        return (
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 opacity-60">
                <div className="text-xs text-blue-300 mb-1">
                    {listing.sellerFarbe} {listing.sellerName} — {listing.ships} ship{listing.ships !== 1 ? 's' : ''} @ {listing.askingPrice.toLocaleString()}€
                </div>
                <div className="text-sm text-blue-400">↩️ No bids — ship returned to seller</div>
            </div>
        )
    }

    return (
        <div className={`border rounded-lg p-3 ${isWinning ? 'border-green-400/40 bg-green-900/20' : 'border-white/15 bg-white/5'}`}>
            <div className="flex items-start justify-between mb-1.5">
                <div>
                    <div className="text-xs font-bold text-white">
                        {listing.sellerFarbe} {listing.sellerName} — {listing.ships} ship{listing.ships !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-blue-300">asking {listing.askingPrice.toLocaleString()}€</div>
                </div>
                <div className="shrink-0 ml-2">
                    {isSeller && !hasBid && (
                        <button
                            onClick={() => socket.emit('cancel-listing', { roomCode, listingId: listing.id })}
                            className="text-xs bg-red-500/20 hover:bg-red-500/40 border border-red-400/30 px-2 py-0.5 rounded transition-colors text-red-300"
                        >
                            Cancel
                        </button>
                    )}
                    {isSeller && hasBid && <span className="text-xs text-blue-400 bg-white/10 px-2 py-0.5 rounded">Your listing</span>}
                    {!isSeller && isWinning && <span className="text-xs text-green-300 bg-green-900/40 px-2 py-0.5 rounded flex items-center gap-1"><IconTrophy className="w-3 h-3" />Winning</span>}
                    {!isSeller && hasBid && !isWinning && <span className="text-xs text-red-300 bg-red-900/30 px-2 py-0.5 rounded flex items-center gap-1"><IconAlertTriangle className="w-3 h-3" />Outbid</span>}
                    {!isSeller && !hasBid && !isPassed && <span className="text-xs text-blue-500">No bids yet</span>}
                    {!isSeller && isPassed && !hasBid && <span className="text-xs text-blue-500">Passed</span>}
                </div>
            </div>

            {hasBid && (
                <div className="text-xs text-blue-200 mb-2">
                    Top bid: <span className="font-bold text-white">{listing.topBid.toLocaleString()}€</span>
                    {' '}by <span className="text-blue-300">{listing.topBidderName}</span>
                </div>
            )}

            {secLeft != null && (
                <div className="mb-2">
                    <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-blue-400">Timer</span>
                        <span className={secLeft <= 3 ? 'text-red-400 font-bold' : secLeft <= 6 ? 'text-yellow-400' : 'text-green-400'}>{secLeft}s</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div
                            className={`h-1.5 rounded-full transition-none ${secLeft <= 3 ? 'bg-red-400' : secLeft <= 6 ? 'bg-yellow-400' : 'bg-green-400'}`}
                            style={{ width: `${Math.min(100, (secLeft / 10) * 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {!isSeller && !isPassed && (
                <div className="flex gap-2 items-center mt-1">
                    <input
                        type="number"
                        min={minNext}
                        step={10}
                        value={bidInput}
                        onChange={e => setBidInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && placeBid()}
                        placeholder={`≥ ${minNext.toLocaleString()}€`}
                        className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white min-w-0"
                    />
                    <button
                        onClick={placeBid}
                        className="bg-blue-500/30 hover:bg-blue-500/50 border border-blue-400/30 text-xs font-medium px-3 py-1 rounded transition-colors whitespace-nowrap"
                    >
                        Bid
                    </button>
                    <button
                        onClick={() => socket.emit('pass-listing', { roomCode, listingId: listing.id })}
                        className="bg-white/10 hover:bg-white/20 border border-white/10 text-xs text-blue-400 px-3 py-1 rounded transition-colors"
                    >
                        Pass
                    </button>
                </div>
            )}
            {!isSeller && isPassed && (
                <div className="text-xs text-blue-500 mt-1">You passed on this listing</div>
            )}
        </div>
    )
}

// ─── Team color helpers ───────────────────────────────────────────────────────

function TeamDot({ farbe }) {
    return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: teamHex(farbe) }} />
}

// ─── Zone SVG icons ───────────────────────────────────────────────────────────

function IconHarbor() {
    return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="3.5" r="1.5" />
            <line x1="8" y1="5" x2="8" y2="13" />
            <path d="M5 10l3 3 3-3" />
            <path d="M5 8h6" />
        </svg>
    )
}
function IconCoastal() {
    return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M1 6c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0" />
            <path d="M1 10c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0" />
        </svg>
    )
}
function IconDeepSea() {
    return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 2v10" />
            <path d="M5 9l3 3 3-3" />
            <path d="M3 5h2M11 5h2" />
            <circle cx="8" cy="2" r="1" fill="currentColor" stroke="none" />
        </svg>
    )
}

// ─── Toast notification icons ─────────────────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────

function GamePage({ gameState, setGameState, socket, mySlotIndex, roomCode }) {
    const [humanDecisions, setHumanDecisions] = useState({})
    const [currentHarbor, setCurrentHarbor] = useState(0)
    const [currentCoastal, setCurrentCoastal] = useState(0)
    const [currentDeepSea, setCurrentDeepSea] = useState(() => {
        const firstHuman = gameState.teams.find(t => !t.istKI)
        return firstHuman ? firstHuman.fleet : 0
    })
    const [currentShipsOrdered, setCurrentShipsOrdered] = useState(0)
    const [humanBids, setHumanBids] = useState({})
    const [rundenErgebnis, setRundenErgebnis] = useState(null)
    const [activeTab, setActiveTab] = useState('dashboard')
    const [devToast, setDevToast] = useState(false)
    const [buyConfirm, setBuyConfirm] = useState(false)
    const [waitingForServer, setWaitingForServer] = useState(false)
    const [submittedCount, setSubmittedCount] = useState(0)
    const [totalPlayers, setTotalPlayers] = useState(0)
    const [pendingBuys, setPendingBuys] = useState(0)
    const [pendingSells, setPendingSells] = useState(0)
    const devSkipRef = useRef(null)
    const prevFischRef = useRef(gameState.fischbestand)
    const [selectedTeamForIncome, setSelectedTeamForIncome] = useState(() => {
        if (mySlotIndex != null && gameState.teams[mySlotIndex]) return gameState.teams[mySlotIndex].name
        return gameState.teams.find(t => !t.istKI)?.name ?? gameState.teams[0]?.name ?? ''
    })
    const [newListingPrice, setNewListingPrice] = useState(
        () => gameState.marketShipPrice || GAME_CONFIG.auctionPreis
    )
    const [newListingCount, setNewListingCount] = useState(1)
    const [auctionToasts, setAuctionToasts] = useState([])
    function dismissToast(id) {
        setAuctionToasts(t => t.map(x => x.id === id ? { ...x, exiting: true } : x))
        setTimeout(() => setAuctionToasts(t => t.filter(x => x.id !== id)), 200)
    }
    const prevListingsRef = useRef([])
    const myTeamNameRef = useRef(null)

    const isMultiplayer = !!(socket && roomCode)

    // Always-current ref for my team name — avoids stale closure in socket handlers.
    myTeamNameRef.current = (mySlotIndex != null && gameState.teams?.[mySlotIndex]?.name) || null

    // Ref always holds latest allocation values — avoids stale closure in useEffect below.
    const allocRef = useRef({ h: 0, c: 0, d: 0 })

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

    // Hot-seat tracking (single-player only)
    const hotSeatEntry = !isMultiplayer ? humanTeams.find(t => !humanDecisions[t.slotIndex]) : null
    const hotSeatEntryIdx = hotSeatEntry ? humanTeams.indexOf(hotSeatEntry) : -1
    const nextEntry = hotSeatEntryIdx >= 0 && hotSeatEntryIdx < humanTeams.length - 1
        ? humanTeams[hotSeatEntryIdx + 1]
        : null

    // Active player: in multiplayer = my assigned slot; in single-player = next hot-seat player
    const activeSlot = isMultiplayer ? mySlotIndex : (hotSeatEntry ? hotSeatEntry.slotIndex : null)
    const activeTeam = activeSlot !== null ? gameState.teams[activeSlot] : null

    const fleetSize = activeTeam ? activeTeam.fleet : 0
    const totalAllocated = currentHarbor + currentCoastal + currentDeepSea
    const allAllocated = totalAllocated === fleetSize
    const maxShipOrder = activeTeam ? Math.ceil(activeTeam.fleet / 2) : 0
    const affordableShipOrder = activeTeam ? Math.max(0, Math.floor(activeTeam.bankBalance / newShipPriceUI)) : 0
    const safeShipsOrdered = Math.min(currentShipsOrdered, maxShipOrder, affordableShipOrder)

    const marketPriceHistory = gameState.verlauf.filter(v => v.marketShipPrice != null)
    const prevMarketPrice = marketPriceHistory.length >= 2
        ? marketPriceHistory[marketPriceHistory.length - 2].marketShipPrice
        : null
    const emergencyBuyPrice  = Math.round(marketShipPrice * 1.5 / 10) * 10
    const distressSalePrice  = Math.round(marketShipPrice * 0.5 / 10) * 10
    const buyCount  = activeTeam?.instantBuyCount  || 0
    const sellCount = activeTeam?.instantSellCount || 0

    function handleBootKaufen() {
        if (activeSlot === null || buyCount >= 2 || activeTeam.bankBalance < emergencyBuyPrice) return
        const neueBoote = activeTeam.fleet + 1
        setGameState({
            ...gameState,
            teams: gameState.teams.map((team, i) => {
                if (i !== activeSlot) return team
                const newBankBalance = team.bankBalance - emergencyBuyPrice
                return { ...team, fleet: neueBoote, bankBalance: newBankBalance, instantBuyCount: buyCount + 1, auctionPurchases: (team.auctionPurchases || 0) + 1, netWorth: berechneNetWorth(newBankBalance, neueBoote, marketShipPrice) }
            })
        })
        // Auto-allocate the new ship to deep sea so allAllocated stays true
        setCurrentDeepSea(prev => prev + 1)
        if (isMultiplayer) setPendingBuys(prev => prev + 1)
        setBuyConfirm(true)
        setTimeout(() => setBuyConfirm(false), 2000)
    }

    function handleBootVerkaufen() {
        if (activeSlot === null || activeTeam.fleet <= 1 || sellCount >= 2) return
        const neueBoote = activeTeam.fleet - 1
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
                const newBankBalance = team.bankBalance + distressSalePrice
                return { ...team, fleet: neueBoote, bankBalance: newBankBalance, instantSellCount: sellCount + 1, netWorth: berechneNetWorth(newBankBalance, neueBoote, marketShipPrice) }
            })
        })
        if (isMultiplayer) setPendingSells(prev => prev + 1)
    }

    function handleSubmit() {
        if (activeSlot === null) return

        if (isMultiplayer) {
            socket.emit('submit-decision', {
                roomCode,
                decision: {
                    harborShips: currentHarbor,
                    coastalShips: currentCoastal,
                    deepSeaShips: currentDeepSea,
                    shipsToBuy: pendingBuys,
                    shipsToSell: pendingSells,
                    newShipOrders: safeShipsOrdered,
                }
            })
            setPendingBuys(0)
            setPendingSells(0)
            setWaitingForServer(true)
            setCurrentHarbor(0)
            setCurrentCoastal(0)
            setCurrentDeepSea(0)
            setCurrentShipsOrdered(0)
            setHumanBids({})
            return
        }

        const newDecisions = {
            ...humanDecisions,
            [activeSlot]: {
                harbor: currentHarbor,
                coastal: currentCoastal,
                deepSea: currentDeepSea,
                shipsOrdered: safeShipsOrdered,
                auctionBids: { ...humanBids },
            }
        }
        const allDone = humanTeams.every(t => newDecisions[t.slotIndex] !== undefined)

        if (allDone) {
            resolveRound(newDecisions)
            setCurrentHarbor(0)
            setCurrentCoastal(0)
            setCurrentDeepSea(0)
            setHumanBids({})
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
            setCurrentShipsOrdered(0)
            setHumanBids({})
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
            listingEvents: nachRunde.letzteListingEvents || [],
            roundDeliveries: nachRunde.roundDeliveries || [],
            aiShipPurchases: nachRunde.aiShipPurchases || [],
            newPendingOffers: nachRunde.pendingAuctionOffers || [],
            gameStateNachRunde: nachRunde,
        })
    }

    function handleWeiter() {
        if (!rundenErgebnis) return
        const newState = rundenErgebnis.gameStateNachRunde
        const myTeamInNew = isMultiplayer && mySlotIndex != null
            ? newState.teams[mySlotIndex]
            : newState.teams.find(t => !t.istKI)
        // Preserve any listings created while this popup was open
        setGameState(prev => ({
            ...newState,
            auctionListings: prev.auctionListings?.length ? prev.auctionListings : (newState.auctionListings || []),
            teams: prev.auctionListings?.length ? prev.teams : newState.teams,
        }))
        setRundenErgebnis(null)
        setHumanDecisions({})
        setHumanBids({})
        setCurrentHarbor(0)
        setCurrentCoastal(0)
        setCurrentDeepSea(myTeamInNew ? myTeamInNew.fleet : 0)
        setCurrentShipsOrdered(0)
        if (isMultiplayer) {
            setPendingBuys(0)
            setPendingSells(0)
            prevFischRef.current = newState.fischbestand
        }
    }

    function handleListShip() {
        if (!activeTeam || newListingCount < 1 || activeTeam.fleet - newListingCount < 1 || !newListingPrice) return
        if (isMultiplayer) {
            socket.emit('create-listing', {
                roomCode,
                ships: newListingCount,
                askingPrice: Math.max(1, newListingPrice),
            })
            setNewListingCount(1)
            return
        }
        // Single-player: client-side listing
        const listing = {
            id: `hl-${activeSlot}-${gameState.runde}-${Date.now()}`,
            sellerSlot: activeSlot,
            sellerName: activeTeam.name,
            sellerFarbe: activeTeam.farbe,
            ships: newListingCount,
            askingPrice: Math.max(1, newListingPrice),
            bids: {},
        }
        setGameState({
            ...gameState,
            teams: gameState.teams.map((t, i) => i === activeSlot ? { ...t, fleet: t.fleet - listing.ships } : t),
            auctionListings: [...(gameState.auctionListings || []), listing],
        })
        setNewListingCount(1)
    }

    function handleCancelListing(listingId) {
        const listing = (gameState.auctionListings || []).find(l => l.id === listingId)
        if (!listing) return
        setGameState({
            ...gameState,
            teams: gameState.teams.map((t, i) => i === listing.sellerSlot ? { ...t, fleet: t.fleet + listing.ships } : t),
            auctionListings: (gameState.auctionListings || []).filter(l => l.id !== listingId),
        })
    }

    function handlePlaceBid(listingId, bidAmount) {
        setGameState({
            ...gameState,
            auctionListings: (gameState.auctionListings || []).map(l =>
                l.id === listingId ? { ...l, bids: { ...l.bids, [activeSlot]: bidAmount } } : l
            ),
        })
    }

    function handleDevSkip() {
        const otherHumans = gameState.teams.filter((t, idx) => !t.istKI && idx !== mySlotIndex).length
        if (isMultiplayer && otherHumans > 0) return
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
            if (state.fischbestand <= 0) {
                state = { ...state, fischbestand: 0, phase: 'ende' }
                break
            }
        }
        setGameState({ ...state, phase: 'ende' })
    }

    // Keep allocRef current every render so the fleet-trim effect reads fresh values.
    allocRef.current = { h: currentHarbor, c: currentCoastal, d: currentDeepSea }

    // When fleet shrinks (ship listed/sold via auction), trim zone allocations so they
    // never exceed fleet size — prevents the "Allocate X ships first" deadlock.
    useEffect(() => {
        if (!isMultiplayer || mySlotIndex === null) return
        const team = gameState.teams[mySlotIndex]
        if (!team) return
        const { h, c, d } = allocRef.current
        const excess = (h + c + d) - team.fleet
        if (excess <= 0) return
        let nh = h, nc = c, nd = d
        for (let i = 0; i < excess; i++) {
            if (nd > 0) nd--
            else if (nc > 0) nc--
            else if (nh > 0) nh--
        }
        setCurrentHarbor(nh)
        setCurrentCoastal(nc)
        setCurrentDeepSea(nd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState.teams[mySlotIndex ?? 0]?.fleet, isMultiplayer, mySlotIndex])

    // Keyboard shortcut Ctrl/Cmd+Shift+S triggers full simulation (DEV only, disabled in multiplayer)
    devSkipRef.current = handleDevSkip
    useEffect(() => {
        if (!import.meta.env.DEV) return
        function onKey(e) {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
                e.preventDefault()
                setDevToast(true)
                setTimeout(() => setDevToast(false), 2000)
                devSkipRef.current()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    // Multiplayer socket events
    useEffect(() => {
        if (!socket || !isMultiplayer) return

        function onDecisionReceived({ submitted, total }) {
            setSubmittedCount(submitted)
            setTotalPlayers(total)
        }

        function onRoundComplete({ gameState: newGS }) {
            if (import.meta.env.DEV) console.log('[round-complete] verlauf:', JSON.stringify(newGS.verlauf))
            if (mySlotIndex != null) newGS.playerIndex = mySlotIndex
            const lastV = newGS.verlauf[newGS.verlauf.length - 1]
            const alterFisch = lastV?.fischbestand ?? prevFischRef.current
            setRundenErgebnis({
                runde: lastV?.runde ?? (newGS.runde - 1),
                teams: newGS.teams,
                alterFischbestand: alterFisch,
                fischDelta: newGS.fischbestand - alterFisch,
                neuerFischbestand: newGS.fischbestand,
                wetterfaktor: newGS.letzterWetterfaktor ?? lastV?.wetterfaktor,
                gesamtFang: newGS.letzterGesamtFang ?? lastV?.gesamtFang ?? 0,
                auctionEvents: newGS.letzteAuktionEvents || [],
                listingEvents: newGS.letzteListingEvents || [],
                roundDeliveries: newGS.roundDeliveries || [],
                aiShipPurchases: newGS.aiShipPurchases || [],
                newPendingOffers: newGS.pendingAuctionOffers || [],
                gameStateNachRunde: newGS,
            })
            prevFischRef.current = newGS.fischbestand
            setWaitingForServer(false)
            setSubmittedCount(0)
        }

        function onGameEnded({ gameState: newGS }) {
            if (mySlotIndex != null) newGS.playerIndex = mySlotIndex
            const lastV = newGS.verlauf[newGS.verlauf.length - 1]
            const alterFisch = lastV?.fischbestand ?? prevFischRef.current
            setRundenErgebnis({
                runde: lastV?.runde ?? newGS.runde,
                teams: newGS.teams,
                alterFischbestand: alterFisch,
                fischDelta: newGS.fischbestand - alterFisch,
                neuerFischbestand: newGS.fischbestand,
                wetterfaktor: newGS.letzterWetterfaktor ?? lastV?.wetterfaktor,
                gesamtFang: newGS.letzterGesamtFang ?? lastV?.gesamtFang ?? 0,
                auctionEvents: newGS.letzteAuktionEvents || [],
                listingEvents: newGS.letzteListingEvents || [],
                roundDeliveries: newGS.roundDeliveries || [],
                aiShipPurchases: newGS.aiShipPurchases || [],
                newPendingOffers: newGS.pendingAuctionOffers || [],
                gameStateNachRunde: newGS,
            })
            setWaitingForServer(false)
        }

        function onRoundError({ message }) {
            setWaitingForServer(false)
            alert(`Round error: ${message}`)
        }

        function onListingsUpdated({ listings, teams }) {
            // Toast notifications — wrapped in try-catch so any error here never
            // blocks the state update below.
            try {
                const prev = prevListingsRef.current
                const myTeamName = myTeamNameRef.current
                const toasts = []

                for (const listing of listings) {
                    const old = prev.find(l => l.id === listing.id)
                    if (!old) {
                        const isMine = listing.sellerName === myTeamName
                        if (!isMine) {
                            toasts.push({ id: `${listing.id}-new`, type: 'new', msg: `${listing.sellerName} listed ${listing.ships} ship${listing.ships > 1 ? 's' : ''} for ${listing.askingPrice.toLocaleString()}€` })
                        }
                    } else {
                        const topBidChanged = listing.topBid != null && listing.topBid !== (old.topBid ?? null)
                        if (topBidChanged) {
                            const bidderName = listing.topBidderName
                            const isSeller = listing.sellerName === myTeamName
                            const wasTopBidder = old.topBidderName != null && old.topBidderName === myTeamName
                            const isNewTopBidder = bidderName === myTeamName
                            console.log('[toast-bid]', { myTeamName, bidderName, isSeller, wasTopBidder, isNewTopBidder, topBid: listing.topBid, oldTopBid: old.topBid })
                            if (isSeller) {
                                toasts.push({ id: `${listing.id}-bid-${listing.topBid}`, type: 'bid', msg: `${bidderName} bid ${Number(listing.topBid).toLocaleString()}€ on your listing` })
                            } else if (wasTopBidder && !isNewTopBidder) {
                                toasts.push({ id: `${listing.id}-outbid-${listing.topBid}`, type: 'outbid', msg: `You were outbid by ${bidderName} (${Number(listing.topBid).toLocaleString()}€)` })
                            } else if (!isNewTopBidder) {
                                toasts.push({ id: `${listing.id}-bid-${listing.topBid}`, type: 'bid', msg: `${bidderName} bid ${Number(listing.topBid).toLocaleString()}€ on ${listing.sellerName}'s listing` })
                            }
                        }
                    }
                }

                if (toasts.length > 0) {
                    setAuctionToasts(t => [...t, ...toasts])
                    toasts.forEach(toast => {
                        setTimeout(() => dismissToast(toast.id), 5000)
                    })
                }
            } catch (e) {
                console.warn('Auction toast error (non-fatal):', e)
            } finally {
                prevListingsRef.current = listings
            }

            setGameState(prev => ({ ...prev, auctionListings: listings, teams }))
        }

        socket.on('decision-received', onDecisionReceived)
        socket.on('round-complete', onRoundComplete)
        socket.on('game-ended', onGameEnded)
        socket.on('listings-updated', onListingsUpdated)
        socket.on('round-error', onRoundError)

        return () => {
            socket.off('decision-received', onDecisionReceived)
            socket.off('round-complete', onRoundComplete)
            socket.off('game-ended', onGameEnded)
            socket.off('listings-updated', onListingsUpdated)
            socket.off('round-error', onRoundError)
        }
    }, [socket, isMultiplayer, mySlotIndex])

    // ── Tab helpers ──────────────────────────────────────────────────────────────

    const tabs = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'reports',   label: 'Reports' },
        { id: 'market',    label: 'Market' },
    ]

    const fishDichte = Math.max(0, gameState.fischbestand) / maxFischUI
    const fishPct    = Math.round(fishDichte * 100)

    if (import.meta.env.DEV && activeTab === 'reports') {
        console.log('gameState.verlauf:', gameState.verlauf)
    }

    return (
        <div className="w-full h-full bg-gradient-to-br from-blue-800 to-blue-950 text-white flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-400/[0.07] rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-blue-300/[0.06] rounded-full blur-2xl pointer-events-none" />

            {/* DEV shortcut toast */}
            {devToast && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-gray-800 text-gray-200 text-xs px-4 py-2 rounded-full shadow-xl border border-white/10">
                    Simulating game…
                </div>
            )}

            {/* Auction notification toasts */}
            {auctionToasts.length > 0 && (
                <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 items-end pointer-events-none">
                    {auctionToasts.map(toast => {
                        const ToastIcon = toast.type === 'outbid' ? IconAlertTriangle : toast.type === 'bid' ? IconGavel : IconTag
                        return (
                            <div
                                key={toast.id}
                                className={`relative overflow-hidden flex items-center gap-2 pl-3 pr-2 py-2 rounded-xl shadow-xl border text-sm font-medium max-w-xs pointer-events-auto
                                    ${toast.exiting ? 'animate-fade-out' : 'animate-fade-in'}
                                    ${toast.type === 'outbid'
                                        ? 'bg-red-900/90 border-red-500/50 text-red-100'
                                        : toast.type === 'bid'
                                        ? 'bg-blue-800/90 border-blue-400/50 text-blue-100'
                                        : 'bg-green-900/90 border-green-500/50 text-green-100'
                                    }`}
                            >
                                <ToastIcon />
                                <span className="flex-1">{toast.msg}</span>
                                <button
                                    onClick={() => dismissToast(toast.id)}
                                    aria-label="Dismiss notification"
                                    className="shrink-0 text-current/50 hover:text-current transition-colors px-1 leading-none text-base"
                                >
                                    ×
                                </button>
                                {!toast.exiting && (
                                    <div className="absolute bottom-0 left-0 h-0.5 bg-current/40 toast-progress-bar" />
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Round result modal */}
            {rundenErgebnis && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-blue-900 border border-blue-700 rounded-xl p-5 max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-0.5 text-center">Round {rundenErgebnis.runde} Complete</h2>
                        <p className="text-blue-400 text-xs text-center mb-3">End of year {rundenErgebnis.runde}</p>

                        {/* At-a-glance summary strip */}
                        {(() => {
                            const totalDelivered = rundenErgebnis.roundDeliveries.reduce((s, d) => s + d.count, 0)
                            const tradedShips = (rundenErgebnis.auctionEvents || []).filter(e => e.erfolg).length
                                + (rundenErgebnis.listingEvents || []).reduce((s, e) => s + (e.erfolg ? e.ships : 0), 0)
                            const stats = [
                                { Icon: IconFishingRod, label: 'Total catch', value: `${(rundenErgebnis.gesamtFang || 0).toLocaleString()} fish` },
                                { Icon: IconFish, label: 'Fish stock', value: Math.max(0, rundenErgebnis.neuerFischbestand).toLocaleString(), delta: rundenErgebnis.fischDelta },
                                { Icon: IconShip, label: 'Ships delivered', value: totalDelivered > 0 ? `+${totalDelivered}` : '—' },
                                { Icon: IconGavel, label: 'Ships traded', value: tradedShips > 0 ? tradedShips : '—' },
                            ]
                            return (
                                <div className="grid grid-cols-4 gap-2 mb-4">
                                    {stats.map((s, i) => (
                                        <div key={i} className="bg-white/10 rounded-lg p-2 text-center">
                                            <div className="w-7 h-7 mx-auto rounded-lg bg-cyan-500/20 flex items-center justify-center mb-1 text-cyan-300"><s.Icon className="w-4 h-4" /></div>
                                            <div className="text-[11px] text-blue-300">{s.label}</div>
                                            <div className="text-sm font-bold text-white">
                                                {s.value}
                                                {s.delta != null && s.delta !== 0 && (
                                                    <span className={`ml-1 text-xs font-bold ${s.delta >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                        {s.delta >= 0 ? '+' : ''}{s.delta.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        })()}

                        <div className="flex gap-3">
                        {/* YOUR RESULTS */}
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><IconFishingRod className="w-3.5 h-3.5" />Your Results</div>
                            {(showOtherCatches ? rundenErgebnis.teams : rundenErgebnis.teams.filter(t => !t.istKI)).map(team => {
                                const s = team.roundSummary
                                if (!s) return null
                                const fishP = gameState.params?.fishPrice ?? GAME_CONFIG.fischPreis
                                const intRate = gameState.params?.interestRate ?? GAME_CONFIG.zinsRate
                                return (
                                    <div key={team.name} className="bg-white/10 rounded-lg p-3 mb-2 last:mb-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-bold text-sm flex items-center gap-1.5"><TeamDot farbe={team.farbe} />{team.name}</span>
                                            {team.istKI && <span className="text-xs text-blue-400 flex items-center gap-1"><IconRobot className="w-3 h-3" />AI</span>}
                                            {team.shipsInDelivery > 0 && (
                                                <span className="text-xs text-green-400 ml-auto">+{team.shipsInDelivery} ship{team.shipsInDelivery !== 1 ? 's' : ''} arriving next round</span>
                                            )}
                                        </div>
                                        <div className="space-y-0.5 text-xs">
                                            <div className="flex justify-between text-blue-200">
                                                <span>Balance at start of round</span>
                                                <span className="text-white">{s.startBalance.toLocaleString()}€</span>
                                            </div>
                                            <div className="flex justify-between text-blue-200">
                                                <span>Operating costs ({s.harborShips}H / {s.coastalShips}C / {s.deepSeaShips}D ships)</span>
                                                <span className="text-red-300">−{s.opCosts.toLocaleString()}€</span>
                                            </div>
                                            <div className="flex justify-between text-blue-200">
                                                <span>Fish caught: {s.fang} fish × {fishP}€/fish</span>
                                                <span className="text-green-300">+{s.fishRevenue.toLocaleString()}€</span>
                                            </div>
                                            <div className="flex justify-between text-blue-200">
                                                <span>Interest ({(intRate * 100).toFixed(0)}% on {s.minBalance.toLocaleString()}€ min balance)</span>
                                                <span className={s.zinsen >= 0 ? 'text-green-300' : 'text-red-300'}>{s.zinsen >= 0 ? '+' : ''}{s.zinsen.toLocaleString()}€</span>
                                            </div>
                                            {s.actualOrder > 0 && (
                                                <div className="flex justify-between text-blue-200">
                                                    <span>Ship orders ({s.actualOrder} × {(s.newShipPrice ?? newShipPriceUI).toLocaleString()}€)</span>
                                                    <span className="text-red-300">−{s.orderCost.toLocaleString()}€</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-bold text-sm pt-1.5 border-t border-white/15 mt-1">
                                                <span>Final balance</span>
                                                <span>{s.finalBalance.toLocaleString()}€</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Right column — fishery update & market activity */}
                        <div className="w-[38%] flex-none flex flex-col gap-3 self-stretch">

                        {/* FISHERY UPDATE */}
                        {(() => {
                            const naturalGrowth = rundenErgebnis.neuerFischbestand - rundenErgebnis.alterFischbestand + (rundenErgebnis.gesamtFang || 0)
                            return (
                                <div className="shrink-0">
                                    <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><IconFish className="w-3.5 h-3.5" />Fishery Update</div>
                                    <div className={`rounded-lg p-3 ${rundenErgebnis.fischDelta < 0 ? 'bg-red-500/20 border border-red-400/30' : 'bg-green-500/15 border border-green-400/20'}`}>
                                        <div className="grid grid-cols-2 gap-x-3 text-xs leading-relaxed mb-2">
                                            <div className="text-blue-200">Total catch: <span className="text-white font-bold">{(rundenErgebnis.gesamtFang || 0).toLocaleString()} fish</span></div>
                                            <div className="text-blue-200">Weather factor: <span className="text-white font-bold">{rundenErgebnis.wetterfaktor != null ? rundenErgebnis.wetterfaktor.toFixed(2) : '—'}×</span></div>
                                            <div className="text-blue-200">Natural growth: <span className={naturalGrowth >= 0 ? 'text-green-300' : 'text-red-300'}>{naturalGrowth >= 0 ? '+' : ''}{naturalGrowth.toLocaleString()} fish</span></div>
                                            <div className="text-blue-200">Net stock change: <span className={rundenErgebnis.fischDelta >= 0 ? 'text-green-300' : 'text-red-300'}>{rundenErgebnis.fischDelta >= 0 ? '+' : ''}{rundenErgebnis.fischDelta.toLocaleString()} fish</span></div>
                                        </div>
                                        <div className={`font-bold text-sm text-center ${rundenErgebnis.fischDelta < 0 ? 'text-red-200' : 'text-green-200'}`}>
                                            Fish stock: {Math.max(0, rundenErgebnis.alterFischbestand).toLocaleString()} → {Math.max(0, rundenErgebnis.neuerFischbestand).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}

                        {/* Merged Market Activity feed — deliveries, AI purchases, pending offers, auction & listing results */}
                        {(() => {
                            const items = []
                            rundenErgebnis.roundDeliveries.forEach((d, i) => items.push({
                                key: `del-${i}`, Icon: IconShip, color: 'text-green-200', farbe: d.farbe,
                                text: `${d.name}: +${d.count} ship${d.count !== 1 ? 's' : ''} delivered`
                            }))
                            ;(rundenErgebnis.aiShipPurchases || []).forEach((p, i) => items.push({
                                key: `aip-${i}`, Icon: IconRobot, color: 'text-blue-200', farbe: p.farbe,
                                text: `${p.name} purchased ${p.count} ship${p.count !== 1 ? 's' : ''} at auction (${p.price.toLocaleString()}€ each)`
                            }))
                            ;(rundenErgebnis.newPendingOffers || []).forEach((o, i) => items.push({
                                key: `pend-${i}`, Icon: IconHourglass, color: 'text-yellow-200', farbe: o.sellerFarbe,
                                text: `${o.sellerName} offered ${o.count} ship${o.count !== 1 ? 's' : ''} at auction — bid in the Market tab next round`
                            }))
                            rundenErgebnis.auctionEvents.forEach((ev, i) => items.push({
                                key: `auc-${i}`, Icon: IconGavel, color: ev.erfolg ? 'text-yellow-200' : 'text-blue-400',
                                text: ev.erfolg
                                    ? `1 ship sold to ${ev.kaeufer} for ${ev.preis.toLocaleString()}€`
                                    : 'No bid received – ship not sold'
                            }))
                            ;(rundenErgebnis.listingEvents || []).forEach((ev, i) => items.push({
                                key: `list-${i}`, Icon: IconClipboard, color: ev.erfolg ? 'text-indigo-200' : 'text-blue-400',
                                text: ev.erfolg
                                    ? `${ev.ships} ship${ev.ships !== 1 ? 's' : ''} from ${ev.sellerName} sold to ${ev.kaeufer} for ${ev.preis.toLocaleString()}€`
                                    : `${ev.ships} ship${ev.ships !== 1 ? 's' : ''} from ${ev.sellerName} – no qualifying bid, returned to seller`
                            }))

                            return (
                                <div className="bg-white/5 border border-white/10 rounded-lg p-2.5 flex-1 flex flex-col min-h-[8rem]">
                                    <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><IconNewspaper className="w-3.5 h-3.5" />Market Activity</div>
                                    {items.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center text-xs text-blue-400 italic text-center px-4">
                                            No deliveries, trades or auction activity this round.
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5 overflow-y-auto pr-1">
                                            {items.map(item => (
                                                <div key={item.key} className={`text-xs flex items-start gap-1.5 ${item.color}`}>
                                                    <item.Icon className="w-3.5 h-3.5 mt-0.5" />
                                                    {item.farbe && <span className="mt-0.5"><TeamDot farbe={item.farbe} /></span>}
                                                    <span>{item.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })()}

                        {rundenErgebnis.neuerFischbestand < maxFischUI * 0.40 && (
                            <div className="bg-orange-500/20 border border-orange-400/40 rounded-lg p-2.5 text-xs text-orange-200 text-center">
                                <strong>Warning:</strong> Fish stock is below 40% — sustainable yields are at risk!
                            </div>
                        )}
                        </div>
                        </div>

                        <button
                            onClick={handleWeiter}
                            className="w-full bg-green-500 hover:bg-green-400 font-bold py-3 rounded-xl transition-colors text-base mt-4"
                        >
                            {rundenErgebnis.gameStateNachRunde?.phase === 'ende' || rundenErgebnis.gameStateNachRunde?.fischbestand <= 0
                                ? 'View Final Results →'
                                : `Continue to Round ${rundenErgebnis.runde + 1} →`
                            }
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex-none relative flex justify-between items-center px-4 py-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <h1 className="text-base font-bold">Fish Banks Game</h1>
                    {isMultiplayer && activeTeam && (
                        <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded font-medium bg-blue-500/30 text-blue-200">
                            <TeamDot farbe={activeTeam.farbe} />
                            {activeTeam.name} (You)
                        </span>
                    )}
                    {!isMultiplayer && humanTeams.length > 1 && activeTeam && (
                        <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded font-medium bg-blue-500/30 text-blue-200">
                            <TeamDot farbe={activeTeam.farbe} />
                            {activeTeam.name} ({hotSeatEntryIdx + 1}/{humanTeams.length})
                        </span>
                    )}
                </div>
                {isMultiplayer && totalPlayers > 1 && (
                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                        <span className="text-xs text-blue-300">Submitted:</span>
                        <span className="text-sm font-bold text-white">{submittedCount} / {totalPlayers}</span>
                    </div>
                )}
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
                                ? 'border-cyan-400 text-white'
                                : 'border-transparent text-blue-400 hover:text-blue-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">

                {/* ── Tab 1: Dashboard ──────────────────────────────────────────── */}
                {activeTab === 'dashboard' && (
                    <div className="p-3 flex flex-col gap-2 h-full">

                        {/* Team cards — single row, rich data */}
                        <div className="flex-none flex gap-2">
                            {gameState.teams.map((team, index) => {
                                const isActive = index === activeSlot
                                const hasSubmitted = !team.istKI && humanDecisions[index] !== undefined
                                const fleetVal = team.fleet * marketShipPrice
                                const rs = team.roundSummary
                                const lastNetIncome = rs ? rs.fishRevenue - rs.opCosts : null
                                return (
                                    <div
                                        key={team.name}
                                        className={`flex-1 rounded-xl px-3 py-2.5 overflow-hidden transition-all border-l-4 ${
                                            isActive ? 'bg-white/15' :
                                            hasSubmitted ? 'bg-green-900/20' :
                                            'bg-white/8'
                                        }`}
                                        style={{
                                            borderLeftColor: teamHex(team.farbe),
                                            boxShadow: isActive ? `0 0 20px ${teamHex(team.farbe)}33, inset 0 0 0 1px ${teamHex(team.farbe)}22` : 'none'
                                        }}
                                    >
                                        <div className="flex justify-between items-center mb-0.5">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <TeamDot farbe={team.farbe} />
                                                <span className="font-bold text-sm truncate">{team.name}</span>
                                            </div>
                                            <span className="text-xs opacity-70 shrink-0 ml-1 inline-flex items-center">
                                                {team.istKI ? (
                                                    team.disconnectedHuman
                                                        ? <IconPlug className="w-3 h-3 text-orange-400" />
                                                        : <IconRobot className="w-3 h-3" />
                                                ) : hasSubmitted ? (
                                                    <IconCheck className="w-3 h-3 text-green-400" />
                                                ) : isActive ? (
                                                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                                ) : (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                                                )}
                                            </span>
                                        </div>
                                        {team.istKI && (
                                            <div className="text-xs mb-1">
                                                {team.disconnectedHuman
                                                    ? <span className="text-orange-400">Disconnected · AI playing</span>
                                                    : <span className="text-blue-500">{team.aiDifficulty === 'hard' ? 'Hard AI' : 'Easy AI'}</span>
                                                }
                                            </div>
                                        )}
                                        <div className="text-xs space-y-0.5 mb-1">
                                            <div className="flex justify-between">
                                                <span className="text-blue-300">Balance</span>
                                                <span className="text-white">{team.bankBalance.toLocaleString()}€</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-blue-300">Fleet</span>
                                                <span className="text-yellow-300">{team.fleet} × {marketShipPrice.toLocaleString()}€ = {fleetVal.toLocaleString()}€</span>
                                            </div>
                                            <div className="border-t border-white/20" />
                                            <div className="flex justify-between font-bold">
                                                <span className="text-blue-200">Net Worth</span>
                                                <span className="text-white text-sm">{team.netWorth.toLocaleString()}€</span>
                                            </div>
                                        </div>
                                        {(team.shipsInDelivery || 0) > 0 && (
                                            <div className="text-xs text-green-400 mb-0.5">+{team.shipsInDelivery} arriving next round</div>
                                        )}
                                        {rs && (
                                            <div className="text-xs border-t border-white/10 pt-0.5 mt-0.5 text-blue-400">
                                                Rnd {gameState.runde - 1}: {rs.fang} fish ·{' '}
                                                <span className={lastNetIncome >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                    {lastNetIncome >= 0 ? '+' : ''}{lastNetIncome.toLocaleString()}€
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Fish stock bar */}
                        <div className={`flex-none bg-white/10 border border-white/5 rounded-xl px-3 py-2 ${fishDichte <= 0.30 ? 'pulse-critical' : ''}`}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-sm">Fish Stock</span>
                                {showFishStock
                                    ? <span className="font-bold text-sm">{Math.max(0, gameState.fischbestand).toLocaleString()} / {maxFischUI.toLocaleString()}</span>
                                    : <span className="font-bold text-sm text-blue-400">Hidden by instructor</span>
                                }
                            </div>
                            <div className="w-full rounded-full h-3 overflow-hidden mb-1 relative" style={{ background: 'rgba(255,255,255,0.12)' }}>
                                {showFishStock && (
                                    <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(to right, #ef4444, #f59e0b 40%, #22c55e 80%)' }} />
                                )}
                                <div
                                    className="absolute top-0 right-0 h-full fish-bar-transition rounded-r-full"
                                    style={{
                                        width: showFishStock ? `${100 - fishPct}%` : '0%',
                                        background: 'rgba(10,20,40,0.8)'
                                    }}
                                />
                                {!showFishStock && (
                                    <div className="absolute inset-0 rounded-full fish-bar-transition" style={{ background: '#3b82f6' }} />
                                )}
                            </div>
                            <div className={`text-xs ${showFishStock ? (fishDichte > 0.60 ? 'text-green-300' : fishDichte > 0.30 ? 'text-yellow-300' : 'text-red-300') : 'text-blue-400'}`}>
                                {showFishStock ? (fishDichte > 0.60 ? 'Healthy' : fishDichte > 0.30 ? 'Endangered' : 'Critical!') : 'Observe catch rates to estimate stock'}
                            </div>
                        </div>

                        {/* Decision panel */}
                        {waitingForServer ? (
                            <div className="flex-1 min-h-0 bg-white/10 rounded-xl p-3 flex flex-col items-center justify-center gap-3">
                                <p className="text-blue-200 text-sm font-medium">Decision submitted!</p>
                                {totalPlayers > 1 && (
                                    <p className="text-blue-400 text-xs">Waiting for other players… {submittedCount} / {totalPlayers}</p>
                                )}
                                <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                                        style={{ width: `${totalPlayers > 0 ? (submittedCount / totalPlayers) * 100 : 50}%` }}
                                    />
                                </div>
                            </div>
                        ) : activeTeam ? (
                            <div className="flex-1 min-h-0 bg-white/10 border border-white/5 rounded-xl p-3 flex flex-col gap-2 overflow-y-auto">

                                <h2 className="font-bold text-sm">{activeTeam.name} – Ship Allocation</h2>

                                {(activeTeam.shipsInDelivery || 0) > 0 && (
                                    <div className="bg-green-500/15 border border-green-400/30 rounded-lg px-2.5 py-1 text-xs text-green-200">
                                        {activeTeam.shipsInDelivery} ship{activeTeam.shipsInDelivery !== 1 ? 's' : ''} arriving this round from last round's order
                                    </div>
                                )}

                                {/* Zone allocator */}
                                <div className="bg-white/5 rounded-lg p-2.5">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-xs font-bold text-blue-200">Deploy {fleetSize} ships:</span>
                                        <span className={`text-xs font-bold ${allAllocated ? 'text-green-300' : 'text-yellow-300'}`}>
                                            {totalAllocated} / {fleetSize}
                                        </span>
                                    </div>
                                    {[
                                        { label: 'Harbor',   icon: <IconHarbor />,   hint: '50€/ship · no catch',    val: currentHarbor,  set: setCurrentHarbor },
                                        { label: 'Coastal',  icon: <IconCoastal />,  hint: '150€/ship · max 15/ship', val: currentCoastal, set: setCurrentCoastal },
                                        { label: 'Deep Sea', icon: <IconDeepSea />,  hint: '250€/ship · max 25/ship', val: currentDeepSea, set: setCurrentDeepSea },
                                    ].map(({ label, icon, hint, val, set }) => (
                                        <div key={label} className="flex items-center gap-1.5 mb-1 last:mb-0">
                                            <div className="flex items-center gap-1 w-[72px] text-blue-300">
                                                {icon}
                                                <span className="text-xs">{label}</span>
                                            </div>
                                            <button onClick={() => set(Math.max(0, val - 1))} disabled={val === 0}
                                                aria-label={`Fewer ships to ${label}`}
                                                className="bg-white/20 hover:bg-white/30 disabled:opacity-30 w-6 h-6 rounded-full font-bold text-sm flex items-center justify-center shrink-0">−</button>
                                            <span className="w-5 text-center font-bold text-sm">{val}</span>
                                            <button onClick={() => set(val + 1)} disabled={totalAllocated >= fleetSize}
                                                aria-label={`More ships to ${label}`}
                                                className="bg-white/20 hover:bg-white/30 disabled:opacity-30 w-6 h-6 rounded-full font-bold text-sm flex items-center justify-center shrink-0">+</button>
                                            <span className="text-xs text-blue-300 opacity-70">{hint}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Zone Statistics table */}
                                {(() => {
                                    const sqrtD     = Math.sqrt(Math.max(0, fishDichte))
                                    const fishPrice = gameState.params?.fishPrice   ?? GAME_CONFIG.fischPreis
                                    const hCost     = gameState.params?.harborCost  ?? GAME_CONFIG.harborCost
                                    const cCost     = gameState.params?.coastalCost ?? GAME_CONFIG.coastalCost
                                    const dCost     = gameState.params?.deepSeaCost ?? GAME_CONFIG.deepSeaCost
                                    const cCatch    = 15 * sqrtD
                                    const dCatch    = 25 * sqrtD
                                    const cRev      = cCatch * fishPrice
                                    const dRev      = dCatch * fishPrice
                                    const hProfit   = -hCost
                                    const cProfit   = cRev - cCost
                                    const dProfit   = dRev - dCost
                                    const pCls      = v => v >= 0 ? 'text-green-300' : 'text-red-300'
                                    const fmt       = v => v.toFixed(1)
                                    const rows = [
                                        { label: 'Catch/Ship',   h: '0',             c: fmt(cCatch),      d: fmt(dCatch) },
                                        { label: 'Fish Price',   h: `${fishPrice}€`, c: `${fishPrice}€`,  d: `${fishPrice}€` },
                                        { label: 'Revenue/Ship', h: '0€',            c: `${fmt(cRev)}€`,  d: `${fmt(dRev)}€` },
                                        { label: 'Op Cost/Ship', h: `${hCost}€`,     c: `${cCost}€`,      d: `${dCost}€` },
                                    ]
                                    return (
                                        <div className="bg-white/5 rounded-lg p-2.5">
                                            <div className="text-xs font-bold text-blue-200 mb-1">Zone Statistics (current fish density)</div>
                                            <div className="grid grid-cols-4 gap-x-2 text-xs mb-0.5">
                                                <div />
                                                <div className="font-medium text-blue-200 text-center">Harbor</div>
                                                <div className="font-medium text-blue-200 text-center">Coastal</div>
                                                <div className="font-medium text-blue-200 text-center">Deep Sea</div>
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
                                                <div className={`text-center ${pCls(hProfit)}`}>−{hCost}€</div>
                                                <div className={`text-center ${pCls(cProfit)}`}>{cProfit >= 0 ? '+' : ''}{fmt(cProfit)}€</div>
                                                <div className={`text-center ${pCls(dProfit)}`}>{dProfit >= 0 ? '+' : ''}{fmt(dProfit)}€</div>
                                            </div>
                                            <div className="text-xs text-blue-500 mt-1">Based on current fish density: {fishPct}%</div>
                                        </div>
                                    )
                                })()}

                                {/* Expected This Round */}
                                {(() => {
                                    const sqrtD = Math.sqrt(Math.max(0, fishDichte))
                                    const fishP = gameState.params?.fishPrice ?? GAME_CONFIG.fischPreis
                                    const hCst = gameState.params?.harborCost ?? GAME_CONFIG.harborCost
                                    const cCst = gameState.params?.coastalCost ?? GAME_CONFIG.coastalCost
                                    const dCst = gameState.params?.deepSeaCost ?? GAME_CONFIG.deepSeaCost
                                    const expCatch = Math.round((currentCoastal * 15 + currentDeepSea * 25) * sqrtD)
                                    const expRev = expCatch * fishP
                                    const expOp = currentHarbor * hCst + currentCoastal * cCst + currentDeepSea * dCst
                                    const expNet = expRev - expOp
                                    return (
                                        <div className="bg-white/5 rounded-lg p-2.5">
                                            <div className="text-xs font-bold text-blue-200 mb-1.5">Expected This Round</div>
                                            <div className="grid grid-cols-3 gap-x-3 text-xs leading-relaxed mb-2">
                                                <div className="text-blue-300">Catch: <span className="text-white font-bold">~{expCatch}</span></div>
                                                <div className="text-blue-300">Revenue: <span className="text-green-300">+{expRev.toLocaleString()}€</span></div>
                                                <div className="text-blue-300">Op costs: <span className="text-red-300">−{expOp.toLocaleString()}€</span></div>
                                            </div>
                                            <div className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${expNet >= 0 ? 'bg-green-500/15 border border-green-400/20' : 'bg-red-500/15 border border-red-400/20'}`}>
                                                <span className="text-xs font-bold text-blue-200">Net income</span>
                                                <span className={`font-bold text-base ${expNet >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                    {expNet >= 0 ? '+' : ''}{expNet.toLocaleString()}€
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })()}

                                {/* Order New Ships */}
                                <div className="flex gap-2 items-start">
                                    <div className="flex-1 bg-cyan-500/10 border border-cyan-400/15 rounded-lg px-2.5 py-1.5">
                                        <div className="text-xs font-bold text-blue-200 mb-1">
                                            Order New Ships
                                            <span className="font-normal text-blue-400"> · {newShipPriceUI.toLocaleString()}€ · next round · max {maxShipOrder}</span>
                                        </div>
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {Array.from({ length: maxShipOrder + 1 }, (_, i) => {
                                                const affordable = i <= affordableShipOrder
                                                return (
                                                    <button
                                                        key={i}
                                                        onClick={() => affordable && setCurrentShipsOrdered(i)}
                                                        disabled={!affordable}
                                                        title={!affordable ? 'Nicht genug Kapital' : undefined}
                                                        className={`min-w-[1.75rem] h-7 rounded px-1 font-bold text-sm transition-colors ${
                                                            !affordable
                                                                ? 'bg-white/5 text-red-400 cursor-not-allowed'
                                                                : safeShipsOrdered === i ? 'bg-cyan-500 text-white' : 'bg-white/20 hover:bg-white/30 text-white'
                                                        }`}
                                                    >{i}</button>
                                                )
                                            })}
                                            {safeShipsOrdered > 0 && (
                                                <span className="text-xs text-blue-300 ml-0.5">−{(safeShipsOrdered * newShipPriceUI).toLocaleString()}€</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        ) : (
                            <div className="flex-1 min-h-0 bg-white/10 rounded-xl p-3 flex items-center justify-center">
                                <p className="text-blue-300 text-center text-xs">All decisions submitted.<br />Processing round…</p>
                            </div>
                        )}

                        {!waitingForServer && activeTeam && (
                            <button
                                onClick={handleSubmit}
                                disabled={!allAllocated}
                                className="flex-none w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-2.5 rounded-xl text-sm transition-colors"
                            >
                                {allAllocated ? `Confirm Round ${gameState.runde}` : `Allocate all ${fleetSize} ships first`}
                            </button>
                        )}
                    </div>
                )}

                {/* ── Tab 2: Reports ────────────────────────────────────────────── */}
                {activeTab === 'reports' && (
                    <div className="p-3 flex gap-3">

                        {/* Left column: Annual Report */}
                        <div className="flex-1 flex flex-col gap-3 min-w-0">
                            <h3 className="text-xs font-medium text-blue-400 uppercase tracking-wide mb-1">Annual Report</h3>
                                {(showOtherCatches ? gameState.teams : gameState.teams.filter(t => !t.istKI)).map(team => {
                                    const rows = []

                                    // Round 0 starting state — derive from first verlauf _rs if available
                                    const firstRs = gameState.verlauf[0]?.[`${team.name}_rs`]
                                    const startBal = firstRs?.startBalance ?? GAME_CONFIG.startGuthaben
                                    rows.push({ runde: 0, isStart: true, balance: startBal })

                                    // Historical rounds
                                    for (let i = 0; i < gameState.verlauf.length; i++) {
                                        const v = gameState.verlauf[i]
                                        const rs = v[`${team.name}_rs`]
                                        if (rs) {
                                            rows.push({ runde: v.runde, isStart: false, ...rs })
                                        } else if (i === gameState.verlauf.length - 1 && team.roundSummary) {
                                            rows.push({ runde: v.runde, isStart: false, ...team.roundSummary })
                                        }
                                    }

                                    const dataRows = rows.filter(r => !r.isStart)
                                    const totCatch = dataRows.reduce((s, r) => s + (r.fang || 0), 0)
                                    const totRev   = dataRows.reduce((s, r) => s + (r.fishRevenue || 0), 0)
                                    const totOp    = dataRows.reduce((s, r) => s + (r.opCosts || 0), 0)
                                    const totInt   = dataRows.reduce((s, r) => s + (r.zinsen || 0), 0)
                                    const totOrd   = dataRows.reduce((s, r) => s + (r.orderCost || 0), 0)

                                    return (
                                        <div key={team.name} className="bg-white/10 border border-white/5 rounded-xl p-3 border-l-4"
                                            style={{ borderLeftColor: teamHex(team.farbe) }}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <TeamDot farbe={team.farbe} />
                                                <span className="font-bold text-sm">{team.name}</span>
                                                {team.istKI && (
                                                    <span className="text-xs text-blue-300 bg-blue-500/15 px-1.5 py-0.5 rounded">
                                                        AI · {team.aiDifficulty === 'hard' ? 'Hard' : 'Easy'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs border-collapse">
                                                    <thead>
                                                        <tr className="text-blue-400 border-b border-white/10">
                                                            <th className="text-left py-1 pr-2 font-medium">Rnd</th>
                                                            <th className="text-right py-1 px-1 font-medium">Catch</th>
                                                            <th className="text-right py-1 px-1 font-medium">Revenue</th>
                                                            <th className="text-right py-1 px-1 font-medium">Op Cost</th>
                                                            <th className="text-right py-1 px-1 font-medium">Interest</th>
                                                            <th className="text-right py-1 px-1 font-medium">Orders</th>
                                                            <th className="text-right py-1 pl-1 font-medium">Balance</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {rows.map((r, i) => (
                                                            <tr key={i} className={`border-b border-white/5 ${i % 2 !== 0 ? 'bg-white/5' : ''}`}>
                                                                <td className="py-0.5 pr-2 text-blue-400">{r.isStart ? 'Start' : r.runde}</td>
                                                                <td className="py-0.5 px-1 text-right">{r.isStart ? '—' : (r.fang || 0)}</td>
                                                                <td className="py-0.5 px-1 text-right text-green-400">{r.isStart ? '—' : `+${(r.fishRevenue || 0).toLocaleString()}€`}</td>
                                                                <td className="py-0.5 px-1 text-right text-red-400">{r.isStart ? '—' : `−${(r.opCosts || 0).toLocaleString()}€`}</td>
                                                                <td className="py-0.5 px-1 text-right">
                                                                    {r.isStart ? '—' : (
                                                                        <span className={(r.zinsen || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                                            {(r.zinsen || 0) >= 0 ? '+' : ''}{(r.zinsen || 0).toLocaleString()}€
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="py-0.5 px-1 text-right text-red-400">
                                                                    {r.isStart ? '—' : ((r.orderCost || 0) > 0 ? `−${(r.orderCost || 0).toLocaleString()}€` : '—')}
                                                                </td>
                                                                <td className="py-0.5 pl-1 text-right font-bold">{(r.finalBalance ?? r.balance ?? 0).toLocaleString()}€</td>
                                                            </tr>
                                                        ))}
                                                        {dataRows.length > 0 && (
                                                            <tr className="border-t border-white/20 font-bold text-blue-200 bg-white/5">
                                                                <td className="py-1 pr-2">Total</td>
                                                                <td className="py-1 px-1 text-right">{totCatch}</td>
                                                                <td className="py-1 px-1 text-right text-green-400">+{totRev.toLocaleString()}€</td>
                                                                <td className="py-1 px-1 text-right text-red-400">−{totOp.toLocaleString()}€</td>
                                                                <td className="py-1 px-1 text-right">{totInt >= 0 ? '+' : ''}{totInt.toLocaleString()}€</td>
                                                                <td className="py-1 px-1 text-right text-red-400">−{totOrd.toLocaleString()}€</td>
                                                                <td className="py-1 pl-1 text-right">{team.bankBalance.toLocaleString()}€</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )
                                })}

                            {gameState.verlauf.length > 0 && (
                                <div className="bg-white/10 rounded-xl p-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-bold text-sm">Income & Expenses per Year</h3>
                                        <div className="flex gap-1">
                                            {gameState.teams.map(t => (
                                                <button
                                                    key={t.name}
                                                    onClick={() => setSelectedTeamForIncome(t.name)}
                                                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                                                        selectedTeamForIncome === t.name
                                                            ? 'bg-white/20 text-white'
                                                            : 'bg-white/5 text-blue-300 hover:bg-white/15'
                                                    }`}
                                                >
                                                    <TeamDot farbe={t.farbe} />
                                                    <span>{t.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {(() => {
                                        const incomeData = gameState.verlauf.map(v => {
                                            const rs = v[`${selectedTeamForIncome}_rs`]
                                            return {
                                                runde: v.runde,
                                                Revenue: rs?.fishRevenue ?? 0,
                                                'Op Costs': rs?.opCosts ?? 0,
                                                'Net Profit': (rs?.fishRevenue ?? 0) - (rs?.opCosts ?? 0),
                                            }
                                        })
                                        return (
                                            <ResponsiveContainer width="100%" height={200}>
                                                <BarChart data={incomeData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                    <XAxis dataKey="runde" tick={{ fill: '#93c5fd', fontSize: 10 }} />
                                                    <YAxis tick={{ fill: '#93c5fd', fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#1e3a5f', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 11 }}
                                                        formatter={(value, name) => [`${value.toLocaleString()}€`, name]}
                                                        labelFormatter={label => `Round ${label}`}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: 10, color: '#93c5fd' }} />
                                                    <Bar dataKey="Revenue" fill="#22c55e" radius={[2, 2, 0, 0]} />
                                                    <Bar dataKey="Op Costs" fill="#ef4444" radius={[2, 2, 0, 0]} />
                                                    <Bar dataKey="Net Profit" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* Right column: Graph + Fishery Data */}
                        <div className="w-[32%] flex-none flex flex-col gap-3">

                            <h3 className="text-xs font-medium text-blue-400 uppercase tracking-wide mb-1">Fishery Report</h3>

                            {/* FishGraph — component has its own bg-white/10 rounded-xl */}
                            <div style={{ height: 300 }}>
                                <FishGraph verlauf={gameState.verlauf} maxFisch={maxFischUI} />
                            </div>

                            {/* Fishery Data table */}
                            <div className="bg-white/10 rounded-xl p-3">
                                <h3 className="font-bold text-sm mb-2">Fishery Data</h3>
                                {gameState.verlauf.length === 0 ? (
                                    <p className="text-sm text-blue-400">No data yet – complete the first round.</p>
                                ) : (
                                    <table className="w-full text-sm border-collapse">
                                        <thead>
                                            <tr className="text-blue-400 border-b border-white/10">
                                                <th className="text-left py-1.5 pr-3 font-medium">Rnd</th>
                                                <th className="text-right py-1.5 px-2 font-medium">Stock</th>
                                                <th className="text-right py-1.5 px-2 font-medium">Catch</th>
                                                <th className="text-right py-1.5 pl-2 font-medium">Growth</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-white/5 text-blue-500">
                                                <td className="py-1 pr-3">Start</td>
                                                <td className="py-1 px-2 text-right">{(gameState.params?.startingFishStock ?? GAME_CONFIG.startFischbestand).toLocaleString()}</td>
                                                <td className="py-1 px-2 text-right">—</td>
                                                <td className="py-1 pl-2 text-right">—</td>
                                            </tr>
                                            {gameState.verlauf.map((v, i) => {
                                                const fishAfter = i + 1 < gameState.verlauf.length
                                                    ? (gameState.verlauf[i + 1].fischbestand ?? 0)
                                                    : gameState.fischbestand
                                                const growth = fishAfter - (v.fischbestand ?? 0) + (v.gesamtFang ?? 0)
                                                return (
                                                    <tr key={i} className={`border-b border-white/5 ${i % 2 !== 0 ? 'bg-white/5' : ''}`}>
                                                        <td className="py-1 pr-3 text-blue-400">{v.runde}</td>
                                                        <td className="py-1 px-2 text-right">{(v.fischbestand ?? 0).toLocaleString()}</td>
                                                        <td className="py-1 px-2 text-right text-red-300">{(v.gesamtFang ?? 0).toLocaleString()}</td>
                                                        <td className={`py-1 pl-2 text-right ${growth >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                            {growth >= 0 ? '+' : ''}{growth.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {gameState.verlauf.length > 0 && (
                                <div className="bg-white/10 rounded-xl p-3">
                                    <h3 className="font-bold text-sm mb-2">Fish per Ship per Year</h3>
                                    {(() => {
                                        const LINE_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#f97316']
                                        const fishPerShipData = gameState.verlauf.map(v => {
                                            const entry = { runde: v.runde }
                                            gameState.teams.forEach(team => {
                                                const rs = v[`${team.name}_rs`]
                                                if (rs) {
                                                    const deployed = Math.max(1, (rs.coastalShips || 0) + (rs.deepSeaShips || 0))
                                                    entry[team.name] = +((rs.fang || 0) / deployed).toFixed(2)
                                                }
                                            })
                                            return entry
                                        })
                                        return (
                                            <ResponsiveContainer width="100%" height={180}>
                                                <LineChart data={fishPerShipData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                    <XAxis dataKey="runde" tick={{ fill: '#93c5fd', fontSize: 10 }} />
                                                    <YAxis tick={{ fill: '#93c5fd', fontSize: 10 }} />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#1e3a5f', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 11 }}
                                                        formatter={(value, name) => [`${value} fish/ship`, name]}
                                                        labelFormatter={label => `Round ${label}`}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: 10, color: '#93c5fd' }} />
                                                    {gameState.teams.map((team, i) => (
                                                        <Line key={team.name} type="monotone" dataKey={team.name} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={false} />
                                                    ))}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        )
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Tab 3: Market ─────────────────────────────────────────────── */}
                {activeTab === 'market' && (
                    <div className="p-3 flex gap-3">
                    <div className="flex-1 flex flex-col gap-3 min-w-0">

                        {/* Ship market summary */}
                        <div className="bg-white/10 rounded-xl p-3">
                            <h3 className="font-bold text-sm mb-2">Ship Market</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                                <div className="bg-white/5 rounded-lg p-2.5">
                                    <div className="text-xs text-blue-300 mb-0.5">Current market price</div>
                                    <div className="text-xl font-bold text-yellow-300 flex items-center gap-1.5">
                                        {marketShipPrice.toLocaleString()}€
                                        {prevMarketPrice != null && prevMarketPrice !== marketShipPrice && (
                                            <span className={`text-xs font-bold ${marketShipPrice > prevMarketPrice ? 'text-green-400' : 'text-red-400'}`}>
                                                {marketShipPrice > prevMarketPrice ? '↑' : '↓'} {Math.abs(marketShipPrice - prevMarketPrice).toLocaleString()}€
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-blue-400 mt-0.5">per ship · buy or sell instantly</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-2.5">
                                    <div className="text-xs text-blue-300 mb-0.5">New ship (shipyard)</div>
                                    <div className="text-xl font-bold text-blue-300">{newShipPriceUI.toLocaleString()}€</div>
                                    <div className="text-xs text-blue-400 mt-0.5">{newShipPriceUI.toLocaleString()}€ each · arrives next round</div>
                                </div>
                            </div>
                            {activeTeam && (
                                <>
                                    <div className="bg-orange-500/5 border border-orange-400/20 rounded-lg p-2 mb-2">
                                        <div className="text-xs font-bold text-orange-300/90 uppercase tracking-wide mb-1.5">Instant Trading</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {/* Distress Sale */}
                                            <div className="bg-white/5 border border-white/10 rounded-lg p-2.5">
                                                <div className="text-xs font-bold text-orange-300 mb-1">Distress Sale <span className="text-blue-400 font-normal">({sellCount}/2 used)</span></div>
                                                <button
                                                    onClick={handleBootVerkaufen}
                                                    disabled={activeTeam.fleet <= 1 || sellCount >= 2}
                                                    className="w-full bg-white/15 hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed font-medium py-1.5 px-2 rounded-lg transition-colors text-xs text-blue-100 border border-white/10 mb-1.5"
                                                >
                                                    {sellCount >= 2 ? 'Used this round' : `Sell 1 Ship – receive ${distressSalePrice.toLocaleString()}€`}
                                                    {activeTeam.fleet <= 1 && sellCount < 2 && <span className="block text-xs text-blue-400 mt-0.5">(min. 1 ship)</span>}
                                                </button>
                                                <div className="text-xs text-orange-400/80">½ market price · max 2/round</div>
                                            </div>

                                            {/* Emergency Buy */}
                                            <div className="bg-white/5 border border-white/10 rounded-lg p-2.5">
                                                <div className="text-xs font-bold text-orange-300 mb-1">Emergency Buy <span className="text-blue-400 font-normal">({buyCount}/2 used)</span></div>
                                                <button
                                                    onClick={handleBootKaufen}
                                                    disabled={activeTeam.bankBalance < emergencyBuyPrice || buyCount >= 2}
                                                    className="w-full bg-white/15 hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed font-medium py-1.5 px-2 rounded-lg transition-colors text-xs text-blue-100 border border-white/10 mb-1.5"
                                                >
                                                    {buyCount >= 2 ? 'Used this round' : `Buy 1 Ship – pay ${emergencyBuyPrice.toLocaleString()}€`}
                                                    {activeTeam.bankBalance < emergencyBuyPrice && buyCount < 2 && <span className="block text-xs text-blue-400 mt-0.5">(insufficient funds)</span>}
                                                </button>
                                                {buyConfirm && <div className="text-xs text-green-300 mb-1">+1 ship purchased for {emergencyBuyPrice.toLocaleString()}€</div>}
                                                <div className="text-xs text-orange-400/80">1.5× market price · max 2/round</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* List Ship for Sale */}
                                    {activeTeam.fleet > 1 && (
                                        <div className="bg-white/5 border border-white/10 rounded-lg p-2.5 mb-2">
                                            <div className="text-xs font-bold text-blue-200 mb-2">List Ship for Sale</div>
                                            <div className="flex gap-2 items-end mb-2 flex-wrap">
                                                <div>
                                                    <div className="text-xs text-blue-400 mb-1">Asking price (€)</div>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        step={10}
                                                        value={newListingPrice}
                                                        onChange={e => setNewListingPrice(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                                                        className="w-24 bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-blue-400 mb-1">Ships (max {activeTeam.fleet - 1})</div>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={activeTeam.fleet - 1}
                                                        value={newListingCount}
                                                        onChange={e => setNewListingCount(Math.max(1, Math.min(activeTeam.fleet - 1, parseInt(e.target.value) || 1)))}
                                                        className="w-16 bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white"
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleListShip}
                                                    className="bg-blue-500/30 hover:bg-blue-500/50 border border-blue-400/30 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    List for Sale
                                                </button>
                                            </div>
                                            <div className="text-xs text-blue-400">
                                                {isMultiplayer
                                                    ? 'Ship removed immediately. 10s timer starts on first bid. All players see it live.'
                                                    : 'Highest bid at or above your asking price wins at end of round.'}
                                            </div>
                                        </div>
                                    )}

                                    {/* Multiplayer: real-time auction cards */}
                                    {isMultiplayer && (gameState.auctionListings || []).length > 0 && (
                                        <div className="space-y-2 mb-2">
                                            <div className="text-xs font-bold text-indigo-300">Live Auction</div>
                                            {(gameState.auctionListings || []).map(listing => (
                                                <AuctionListingCard
                                                    key={listing.id}
                                                    listing={listing}
                                                    mySlotIndex={mySlotIndex}
                                                    socket={socket}
                                                    roomCode={roomCode}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Single-player: existing table UI */}
                                    {!isMultiplayer && (gameState.auctionListings || []).length > 0 && (
                                        <div className="bg-indigo-500/10 border border-indigo-400/30 rounded-lg p-2.5 mb-2">
                                            <div className="text-xs font-bold text-indigo-300 mb-2">Active Listings</div>
                                            <div className="grid grid-cols-5 gap-x-2 text-xs text-blue-400 font-medium pb-1 mb-1 border-b border-white/10">
                                                <div>Seller</div>
                                                <div className="text-center">Ships</div>
                                                <div className="text-right">Asking</div>
                                                <div className="text-right">Your Bid</div>
                                                <div />
                                            </div>
                                            {(gameState.auctionListings || []).map(listing => {
                                                const myBid = listing.bids?.[activeSlot] ?? 0
                                                return (
                                                    <div key={listing.id} className="grid grid-cols-5 gap-x-2 text-xs items-center py-1 border-b border-white/5 last:border-0">
                                                        <div className="text-blue-100 truncate">{listing.sellerFarbe} {listing.sellerName}</div>
                                                        <div className="text-center text-white">{listing.ships}</div>
                                                        <div className="text-right text-yellow-300">{listing.askingPrice.toLocaleString()}€</div>
                                                        <div className="text-right">
                                                            {listing.sellerSlot !== activeSlot ? (
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    step={10}
                                                                    value={myBid || ''}
                                                                    onChange={e => handlePlaceBid(listing.id, Math.max(0, parseInt(e.target.value) || 0))}
                                                                    className="w-20 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-xs text-white text-right"
                                                                    placeholder={`${listing.askingPrice}€`}
                                                                />
                                                            ) : (
                                                                <span className="text-blue-500 text-xs">Your listing</span>
                                                            )}
                                                        </div>
                                                        <div className="text-right">
                                                            {listing.sellerSlot !== activeSlot ? (
                                                                <button
                                                                    onClick={() => handlePlaceBid(listing.id, listing.askingPrice)}
                                                                    className="text-xs bg-green-500/20 hover:bg-green-500/30 border border-green-400/30 px-1.5 py-0.5 rounded transition-colors"
                                                                >Bid</button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleCancelListing(listing.id)}
                                                                    className="text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 px-1.5 py-0.5 rounded transition-colors"
                                                                >Cancel</button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            <div className="text-xs text-blue-500 mt-1.5">Ships removed from fleet immediately. Bids ≥ asking price resolve at end of round.</div>
                                        </div>
                                    )}

                                    {/* Auction — pending AI offers (from last round) */}
                                    {(gameState.pendingAuctionOffers || []).length > 0 && (
                                        <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-lg p-2.5 mb-2">
                                            <div className="text-xs font-bold text-yellow-300 mb-2">Place Bid</div>
                                            {(gameState.pendingAuctionOffers || []).map(offer => (
                                                <div key={offer.id} className="mb-2 last:mb-0">
                                                    <div className="text-xs text-blue-200 mb-1.5">
                                                        {offer.sellerFarbe} {offer.sellerName} offered {offer.count} ship{offer.count !== 1 ? 's' : ''}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-blue-400">Bid:</span>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step={10}
                                                            value={humanBids[offer.id] ?? ''}
                                                            onChange={e => setHumanBids(prev => ({ ...prev, [offer.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                                                            className="w-24 bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white"
                                                            placeholder={`${marketShipPrice}€`}
                                                        />
                                                        <span className="text-xs text-blue-400">€</span>
                                                        <button
                                                            onClick={() => setHumanBids(prev => ({ ...prev, [offer.id]: marketShipPrice }))}
                                                            className="text-xs bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 px-2 py-1 rounded transition-colors"
                                                        >
                                                            Place Bid
                                                        </button>
                                                    </div>
                                                    <div className="text-xs text-blue-500 mt-1">Highest bid wins. Leave blank or 0 to pass.</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Auction — same-round human offers (H→H hot-seat) */}
                                    {Object.entries(humanDecisions)
                                        .filter(([idxStr, d]) => (d.boatsOffered || 0) > 0 && parseInt(idxStr) !== activeSlot)
                                        .map(([idxStr, d]) => {
                                            const sellerIdx = parseInt(idxStr)
                                            const seller = gameState.teams[sellerIdx]
                                            const offerKey = `h-${sellerIdx}`
                                            return (
                                                <div key={idxStr} className="bg-yellow-500/10 border border-yellow-400/30 rounded-lg p-2.5 mb-2">
                                                    <div className="text-xs font-bold text-yellow-300 mb-1">Bid on {seller.name}'s Ships</div>
                                                    <div className="text-xs text-blue-200 mb-1.5 flex items-center gap-1.5">
                                                        <TeamDot farbe={seller.farbe} />{seller.name} offered {d.boatsOffered} ship{d.boatsOffered !== 1 ? 's' : ''} at auction
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-blue-400">Bid:</span>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step={10}
                                                            value={humanBids[offerKey] ?? ''}
                                                            onChange={e => setHumanBids(prev => ({ ...prev, [offerKey]: Math.max(0, parseInt(e.target.value) || 0) }))}
                                                            className="w-24 bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white"
                                                            placeholder={`${marketShipPrice}€`}
                                                        />
                                                        <span className="text-xs text-blue-400">€</span>
                                                    </div>
                                                    <div className="text-xs text-blue-500 mt-1">Highest bid wins. Leave blank or 0 to pass.</div>
                                                </div>
                                            )
                                        })
                                    }

                                    <div className="text-xs text-blue-400 space-y-0.5">
                                        <div>Max order this round: <span className="text-white font-medium">{Math.ceil(activeTeam.fleet / 2)} ships</span> (½ of your fleet of {activeTeam.fleet})</div>
                                        {(activeTeam.shipsInDelivery || 0) > 0 && (
                                            <div className="text-green-400">{activeTeam.shipsInDelivery} ship{activeTeam.shipsInDelivery !== 1 ? 's' : ''} from your order arriving this round</div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Fleet overview — sorted by net worth */}
                        <div className="bg-white/10 rounded-xl p-3">
                            <h3 className="font-bold text-sm mb-2">Fleet Overview</h3>
                            <div className="grid grid-cols-6 gap-x-2 text-xs text-blue-400 font-medium px-3 py-1 mb-1 border-b border-white/10">
                                <div>Rank</div>
                                <div>Team</div>
                                <div className="text-center">Ships</div>
                                <div className="text-right">Fleet Value</div>
                                <div className="text-right">Balance</div>
                                <div className="text-right">Net Worth</div>
                            </div>
                            {(() => {
                                const ranked = [...gameState.teams].sort((a, b) => b.netWorth - a.netWorth)
                                const RANKS = ['1st', '2nd', '3rd', '4th', '5th']
                                return (
                                    <div className="space-y-1">
                                        {ranked.map((team, rankIdx) => {
                                            const fleetValue = team.fleet * marketShipPrice
                                            const isLeader = rankIdx === 0
                                            const isMe = activeTeam && team.name === activeTeam.name
                                            return (
                                                <div key={team.name}
                                                    className={`grid grid-cols-6 gap-x-2 text-xs rounded-lg px-3 py-1.5 items-center ${isLeader ? 'bg-yellow-500/15 border border-yellow-400/20' : 'bg-white/5'} ${isMe ? 'ring-2 ring-cyan-400/50' : ''}`}
                                                    style={isMe ? { boxShadow: `inset 0 0 0 1px ${teamHex(team.farbe)}55` } : undefined}>
                                                    <div className={`font-bold ${isLeader ? 'text-yellow-300' : 'text-blue-500'}`}>{RANKS[rankIdx] ?? `${rankIdx + 1}th`}</div>
                                                    <div className={`flex items-center gap-1.5 font-bold truncate ${isLeader ? 'text-yellow-100' : ''}`}>
                                                        <TeamDot farbe={team.farbe} />{team.name} {team.istKI ? 'AI' : ''}
                                                        {isMe && <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-400/30 px-1 py-0.5 rounded">You</span>}
                                                    </div>
                                                    <div className="text-center text-blue-200">{team.fleet}{(team.shipsInDelivery || 0) > 0 ? <span className="text-green-400"> +{team.shipsInDelivery}</span> : ''}</div>
                                                    <div className="text-right text-yellow-300">{fleetValue.toLocaleString()}€</div>
                                                    <div className="text-right text-blue-200">{team.bankBalance.toLocaleString()}€</div>
                                                    <div className={`text-right font-bold ${isLeader ? 'text-yellow-200' : 'text-white'}`}>{team.netWorth.toLocaleString()}€</div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            })()}
                        </div>

                    </div>

                    {/* Right column — price history & auction history */}
                    <div className="w-[32%] flex-none flex flex-col gap-3">

                        {/* Ship Market Price History */}
                        {gameState.verlauf.some(v => v.marketShipPrice != null) && (
                            <div className="bg-white/10 rounded-xl p-3">
                                <h3 className="font-bold text-sm mb-2">Ship Market Price History</h3>
                                {(() => {
                                    const priceData = gameState.verlauf
                                        .filter(v => v.marketShipPrice != null)
                                        .map(v => ({ runde: v.runde, Price: v.marketShipPrice }))
                                    return (
                                        <ResponsiveContainer width="100%" height={190}>
                                            <LineChart data={priceData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                <XAxis dataKey="runde" tick={{ fill: '#93c5fd', fontSize: 10 }} />
                                                <YAxis tick={{ fill: '#93c5fd', fontSize: 10 }} domain={['auto', 'auto']} tickFormatter={v => `${v}€`} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1e3a5f', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 11 }}
                                                    formatter={v => [`${v.toLocaleString()}€`, 'Market Price']}
                                                    labelFormatter={label => `Round ${label}`}
                                                />
                                                <Line type="monotone" dataKey="Price" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )
                                })()}
                            </div>
                        )}

                        {/* Fleet value by team — visual complement to the Fleet Overview table */}
                        <div className="bg-white/10 rounded-xl p-3">
                            <h3 className="font-bold text-sm mb-2">Fleet Value by Team</h3>
                            {(() => {
                                const fleetValueData = gameState.teams.map(team => ({
                                    name: team.name,
                                    farbe: team.farbe,
                                    value: team.fleet * marketShipPrice,
                                }))
                                return (
                                    <ResponsiveContainer width="100%" height={190}>
                                        <BarChart data={fleetValueData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                            <XAxis dataKey="name" tick={{ fill: '#93c5fd', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={40} />
                                            <YAxis tick={{ fill: '#93c5fd', fontSize: 10 }} tickFormatter={v => `${v.toLocaleString()}€`} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e3a5f', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 11 }}
                                                formatter={v => [`${v.toLocaleString()}€`, 'Fleet Value']}
                                            />
                                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                                {fleetValueData.map((entry, i) => (
                                                    <Cell key={i} fill={teamHex(entry.farbe)} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )
                            })()}
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
                                            <span className="text-white">
                                                {ev.ships || 1} ship{(ev.ships || 1) !== 1 ? 's' : ''}
                                                {ev.sellerName ? ` (${ev.sellerName})` : ''} → {ev.kaeufer}
                                            </span>
                                            <span className="text-yellow-300">{ev.preis.toLocaleString()}€</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    </div>
                )}

            </div>
        </div>
    )
}

export default GamePage
