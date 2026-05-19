import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { GAME_CONFIG, berechneFischbestand } from '../game/fishLogic'

function berechneOptimalesErgebnis(maxRunden, startFischbestand) {
    let fischbestand = startFischbestand
    let totalGuthaben = GAME_CONFIG.startGuthaben

    for (let r = 1; r <= maxRunden && fischbestand > 0; r++) {
        // Optimal: each of 4 teams sends 1 of 3 ships (conservative, ~33% capacity)
        const ausgesandtGesamt = 4  // 1 ship per team × 4 teams
        const dichte = fischbestand / GAME_CONFIG.maxFischbestand
        const eff = 25 * Math.sqrt(Math.max(0, dichte))
        const gesamtFang = Math.min(ausgesandtGesamt * eff, fischbestand)
        const perTeamFang = gesamtFang / 4
        const gewinn = perTeamFang * GAME_CONFIG.fischPreis - 1 * GAME_CONFIG.betriebskosten
        totalGuthaben += gewinn
        fischbestand = berechneFischbestand(fischbestand, Math.round(gesamtFang))
    }

    return { endFischbestand: fischbestand, endGuthaben: Math.round(totalGuthaben) }
}

function EndPage({ gameState, onRestart }) {
    const winner = [...gameState.teams].sort((a, b) => b.netWorth - a.netWorth)[0]
    const kollabiert = gameState.fischbestand === 0
    const maxRunden = gameState.maxRunden || GAME_CONFIG.maxRunden
    const marketShipPrice = gameState.marketShipPrice || GAME_CONFIG.auctionPreis

    const teamColors = ['#ef4444', '#f59e0b', '#22d3ee', '#a78bfa']

    const netWorthDaten = gameState.teams.map(team => ({
        name: team.name,
        'Net Worth': team.netWorth,
    }))

    const sortedTeams = [...gameState.teams].sort((a, b) => b.netWorth - a.netWorth)
    const spielerTeam = gameState.teams[gameState.playerIndex ?? 0]
    const spielerRang = sortedTeams.findIndex(t => t.name === spielerTeam.name) + 1

    const fischScore = (gameState.fischbestand / GAME_CONFIG.maxFischbestand) * 100 * 0.4
    const rangScore = ((4 - spielerRang + 1) / 4) * 100 * 0.6
    const sustainabilityScore = Math.round(fischScore + rangScore)

    const optimal = berechneOptimalesErgebnis(maxRunden, GAME_CONFIG.startFischbestand)

    let niedrigsterBestand = { runde: 0, wert: Infinity }
    let groessterEinzelAbfall = { runde: 0, delta: 0 }
    gameState.verlauf.forEach((v, i) => {
        if (v.fischbestand < niedrigsterBestand.wert) {
            niedrigsterBestand = { runde: v.runde, wert: v.fischbestand }
        }
        if (i > 0) {
            const delta = gameState.verlauf[i - 1].fischbestand - v.fischbestand
            if (delta > groessterEinzelAbfall.delta) {
                groessterEinzelAbfall = { runde: v.runde, delta }
            }
        }
    })

    const scoreColor = sustainabilityScore >= 70 ? 'text-green-400' : sustainabilityScore >= 40 ? 'text-yellow-400' : 'text-red-400'
    const scoreBg = sustainabilityScore >= 70 ? 'bg-green-500/15' : sustainabilityScore >= 40 ? 'bg-yellow-500/15' : 'bg-red-500/15'
    const scoreBarColor = sustainabilityScore >= 70 ? '#22c55e' : sustainabilityScore >= 40 ? '#f59e0b' : '#ef4444'

    return (
        <div className="w-full h-full bg-blue-900 text-white flex flex-col overflow-hidden p-4 gap-3">

            {/* Top strip: title · winner · score */}
            <div className="flex-none grid grid-cols-3 gap-3">

                {/* Title */}
                <div className="bg-white/10 rounded-xl px-5 py-3 flex items-center gap-4">
                    <div>
                        <h1 className="text-lg font-bold leading-tight">
                            {kollabiert ? 'Fish Stock Collapsed!' : 'Game Over!'}
                        </h1>
                        <p className="text-blue-200 text-xs mt-0.5">
                            {kollabiert
                                ? 'Tragedy of the Commons'
                                : `${gameState.fischbestand.toLocaleString()} / ${GAME_CONFIG.maxFischbestand.toLocaleString()} fish`}
                        </p>
                        <p className="text-blue-300 text-xs">{gameState.verlauf.length} rounds played</p>
                    </div>
                </div>

                {/* Winner */}
                <div className="bg-yellow-500/20 rounded-xl px-5 py-3 flex items-center gap-4">
                    <div>
                        <div className="text-xs text-yellow-200 mb-0.5">Winner</div>
                        <div className="text-xl font-bold">{winner.farbe} {winner.name}</div>
                        <div className="text-yellow-200 text-sm font-bold">{winner.netWorth.toLocaleString()}€ Net Worth</div>
                        <div className="text-yellow-300 text-xs">{winner.bankBalance.toLocaleString()}€ + {(winner.fleet * marketShipPrice).toLocaleString()}€ ({winner.fleet} ships)</div>
                    </div>
                </div>

                {/* Sustainability score */}
                <div className={`${scoreBg} rounded-xl px-5 py-3`}>
                    <div className="flex items-center gap-3">
                        <div className={`text-4xl font-bold shrink-0 ${scoreColor}`}>{sustainabilityScore}</div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs text-blue-200 mb-1">Sustainability Score (0–100)</div>
                            <div className="w-full bg-white/20 rounded-full h-2 mb-1">
                                <div className="h-2 rounded-full transition-all duration-1000" style={{ width: `${sustainabilityScore}%`, backgroundColor: scoreBarColor }} />
                            </div>
                            <div className={`text-xs ${scoreColor}`}>
                                {sustainabilityScore >= 70 ? 'Sustainable' : sustainabilityScore >= 40 ? 'Moderate' : 'Unsustainable'}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-blue-300">
                        <div className="bg-white/10 rounded-lg px-2 py-1.5">
                            <div className="text-white font-bold text-xs">Your Result</div>
                            <div>{spielerTeam.netWorth.toLocaleString()}€ Net Worth</div>
                            <div>Rank {spielerRang} / 4</div>
                        </div>
                        <div className="bg-white/10 rounded-lg px-2 py-1.5">
                            <div className="text-white font-bold text-xs">Optimum (33%)</div>
                            <div>{optimal.endFischbestand.toLocaleString()} fish</div>
                            <div>{optimal.endGuthaben.toLocaleString()}€</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main 3-column section */}
            <div className="flex-1 min-h-0 grid grid-cols-3 gap-3">

                {/* Column 1: Leaderboard + Key Moments */}
                <div className="flex flex-col gap-3 min-h-0">

                    <div className="flex-none bg-white/10 rounded-xl p-4">
                        <h2 className="font-bold mb-3 text-sm">Leaderboard</h2>
                        <div className="space-y-2">
                            {sortedTeams.map((team, index) => (
                                <div key={team.name} className="flex justify-between items-center bg-white/10 rounded-lg px-3 py-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '4.'}</span>
                                        <span>{team.farbe} {team.name}</span>
                                        <span className="text-xs text-blue-400">{team.istKI ? '🤖' : ''}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-xs">{team.netWorth.toLocaleString()}€</div>
                                        <div className="text-xs text-blue-300">{team.bankBalance.toLocaleString()}€ + {(team.fleet * marketShipPrice).toLocaleString()}€ ({team.fleet} ships)</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 bg-white/10 rounded-xl p-4 overflow-hidden">
                        <h2 className="font-bold mb-3 text-sm">Key Moments</h2>
                        <div className="space-y-2">
                            {niedrigsterBestand.runde > 0 && (
                                <div className="flex items-start gap-2 bg-red-500/10 rounded-lg p-2.5">
                                    <div>
                                        <div className="font-bold text-xs">Lowest Fish Stock</div>
                                        <div className="text-blue-300 text-xs">Round {niedrigsterBestand.runde}: only {niedrigsterBestand.wert.toLocaleString()} fish</div>
                                    </div>
                                </div>
                            )}
                            {groessterEinzelAbfall.runde > 0 && (
                                <div className="flex items-start gap-2 bg-orange-500/10 rounded-lg p-2.5">
                                    <div>
                                        <div className="font-bold text-xs">Largest Single Decline</div>
                                        <div className="text-blue-300 text-xs">Round {groessterEinzelAbfall.runde}: −{groessterEinzelAbfall.delta.toLocaleString()} fish in one round</div>
                                    </div>
                                </div>
                            )}
                            {gameState.auctionHistory?.length > 0 && (
                                <div className="flex items-start gap-2 bg-yellow-500/10 rounded-lg p-2.5">
                                    <div>
                                        <div className="font-bold text-xs">Auctions this game</div>
                                        <div className="text-blue-300 text-xs">
                                            {gameState.auctionHistory.length} ship{gameState.auctionHistory.length !== 1 ? 's' : ''} at avg {Math.round(gameState.auctionHistory.reduce((s, e) => s + e.preis, 0) / gameState.auctionHistory.length).toLocaleString()}€
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-start gap-2 bg-blue-500/10 rounded-lg p-2.5">
                                <div>
                                    <div className="font-bold text-xs">Final Status</div>
                                    <div className="text-blue-300 text-xs">
                                        {gameState.fischbestand.toLocaleString()} fish – {kollabiert ? 'collapsed' : gameState.fischbestand >= GAME_CONFIG.maxFischbestand * 0.5 ? 'sustained' : 'low'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 2: Charts */}
                <div className="flex flex-col gap-3 min-h-0">

                    <div className="flex-1 min-h-0 bg-white/10 rounded-xl p-4 flex flex-col">
                        <h2 className="flex-none font-bold text-sm mb-1">Fish Stock &amp; Net Worth</h2>
                        <p className="flex-none text-blue-300 text-xs mb-2">History over all rounds</p>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={gameState.verlauf} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="runde" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10 }} />
                                    <YAxis yAxisId="left" domain={[0, GAME_CONFIG.maxFischbestand]} stroke="#22c55e" tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v} tick={{ fontSize: 10 }} width={35} />
                                    <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.3)" tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 10 }} width={38} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e3a8a', border: 'none', borderRadius: '8px', fontSize: 11 }}
                                        formatter={(value, name) => name === 'Fish Stock' ? [`${value.toLocaleString()} fish`, name] : [`${value.toLocaleString()}€`, name]}
                                    />
                                    <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
                                    <Line yAxisId="left" type="monotone" dataKey="fischbestand" stroke="#22c55e" strokeWidth={2} name="Fish Stock" dot={false} />
                                    {gameState.teams.map((team, i) => (
                                        <Line
                                            key={team.name}
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey={d => d[team.name]}
                                            stroke={teamColors[i]}
                                            strokeWidth={1.5}
                                            strokeDasharray="5 3"
                                            name={`${team.name} NW`}
                                            dot={false}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="h-44 bg-white/10 rounded-xl p-4 flex flex-col">
                        <h2 className="flex-none font-bold text-sm mb-1">Net Worth Comparison</h2>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={netWorthDaten} margin={{ top: 2, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10 }} />
                                    <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 10 }} width={35} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e3a8a', border: 'none', borderRadius: '8px', fontSize: 11 }} formatter={v => [`${v.toLocaleString()}€`, 'Net Worth']} />
                                    <Bar dataKey="Net Worth" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Column 3: Learning + Restart */}
                <div className="flex flex-col gap-3 min-h-0">

                    <div className="flex-1 min-h-0 bg-white/10 rounded-xl p-4 overflow-hidden flex flex-col">
                        <h2 className="flex-none font-bold text-sm mb-3">Learning Reflection</h2>
                        <div className="flex-1 min-h-0 space-y-2 overflow-hidden">
                            {kollabiert && (
                                <div className="bg-red-500/20 rounded-xl p-3">
                                    <div className="font-bold text-sm mb-1">Tragedy of the Commons</div>
                                    <p className="text-xs text-blue-200">
                                        Each team acted rationally for itself – but together the resource was destroyed.
                                        This is exactly what Garrett Hardin described in 1968.
                                    </p>
                                </div>
                            )}
                            {!kollabiert && gameState.fischbestand < 30 && (
                                <div className="bg-orange-500/20 rounded-xl p-3">
                                    <div className="font-bold text-sm mb-1">Barely Escaped Collapse</div>
                                    <p className="text-xs text-blue-200">
                                        The stock was at risk. Without a change in behavior, collapse would have followed.
                                    </p>
                                </div>
                            )}
                            {!kollabiert && gameState.fischbestand >= 30 && (
                                <div className="bg-green-500/20 rounded-xl p-3">
                                    <div className="font-bold text-sm mb-1">Sustainably Managed</div>
                                    <p className="text-xs text-blue-200">
                                        The fish stock was preserved. Coordination and restraint prevent collapse.
                                    </p>
                                </div>
                            )}
                            <div className="bg-white/10 rounded-xl p-3">
                                <div className="font-bold text-sm mb-1">Elinor Ostrom (1990)</div>
                                <p className="text-xs text-blue-200">
                                    Nobel laureate: communities can prevent collapse through local governance rules –
                                    without privatization or state control.
                                </p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-3">
                                <div className="font-bold text-sm mb-1">Feedback Delay</div>
                                <p className="text-xs text-blue-200">
                                    The true fish stock was never fully visible. Only declining catches
                                    signaled the problem – often too late.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-none">
                        <button
                            onClick={onRestart}
                            className="w-full bg-green-500 hover:bg-green-400 font-bold py-4 rounded-xl text-lg transition-colors"
                        >
                            Play Again
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EndPage
