import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { GAME_CONFIG, berechneFischbestand, berechneFang, berechneGewinn } from '../game/fishLogic'

function berechneOptimalesErgebnis(maxRunden, startFischbestand) {
    let fischbestand = startFischbestand
    let totalGuthaben = GAME_CONFIG.startGuthaben

    for (let r = 1; r <= maxRunden && fischbestand > 0; r++) {
        const bootsAnzahl = 5
        const ausgesandt = Math.floor(bootsAnzahl * 0.5)
        const gesamteBoote = ausgesandt * 4
        const fang = berechneFang(ausgesandt, fischbestand, gesamteBoote)
        const gewinn = berechneGewinn(fang, ausgesandt)
        totalGuthaben += gewinn
        fischbestand = berechneFischbestand(fischbestand, gesamteBoote)
    }

    return { endFischbestand: fischbestand, endGuthaben: totalGuthaben }
}

function EndPage({ gameState, onRestart }) {
    const winner = [...gameState.teams].sort((a, b) => b.guthaben - a.guthaben)[0]
    const kollabiert = gameState.fischbestand === 0
    const maxRunden = gameState.maxRunden || GAME_CONFIG.maxRunden

    const teamColors = ['#ef4444', '#f59e0b', '#22d3ee', '#a78bfa']

    const guthabenDaten = gameState.teams.map(team => ({
        name: team.name,
        Guthaben: team.guthaben,
    }))

    const sortedTeams = [...gameState.teams].sort((a, b) => b.guthaben - a.guthaben)
    const spielerRang = sortedTeams.findIndex(t => !t.istKI) + 1
    const spielerTeam = gameState.teams[0]

    const fischScore = gameState.fischbestand * 0.4
    const rangScore = ((4 - spielerRang + 1) / 4) * 100 * 0.6
    const sustainabilityScore = Math.round(fischScore + rangScore)

    const optimal = berechneOptimalesErgebnis(maxRunden, GAME_CONFIG.startFischbestand)

    let niedrigsterBestand = { runde: 0, wert: 100 }
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
                    <div className="text-4xl shrink-0">{kollabiert ? '💀' : '🏆'}</div>
                    <div>
                        <h1 className="text-lg font-bold leading-tight">
                            {kollabiert ? 'Fischbestand kollabiert!' : 'Spiel beendet!'}
                        </h1>
                        <p className="text-blue-200 text-xs mt-0.5">
                            {kollabiert
                                ? 'Tragedy of the Commons'
                                : `${gameState.fischbestand}% Fischbestand verbleibend`}
                        </p>
                        <p className="text-blue-300 text-xs">{gameState.verlauf.length} Runden gespielt</p>
                    </div>
                </div>

                {/* Winner */}
                <div className="bg-yellow-500/20 rounded-xl px-5 py-3 flex items-center gap-4">
                    <div className="text-3xl shrink-0">🏆</div>
                    <div>
                        <div className="text-xs text-yellow-200 mb-0.5">Gewinner</div>
                        <div className="text-xl font-bold">{winner.farbe} {winner.name}</div>
                        <div className="text-yellow-200 text-sm">💰 {winner.guthaben.toLocaleString()}€</div>
                    </div>
                </div>

                {/* Sustainability score */}
                <div className={`${scoreBg} rounded-xl px-5 py-3`}>
                    <div className="flex items-center gap-3">
                        <div className={`text-4xl font-bold shrink-0 ${scoreColor}`}>{sustainabilityScore}</div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs text-blue-200 mb-1">🌿 Nachhaltigkeitsscore (0–100)</div>
                            <div className="w-full bg-white/20 rounded-full h-2 mb-1">
                                <div className="h-2 rounded-full transition-all duration-1000" style={{ width: `${sustainabilityScore}%`, backgroundColor: scoreBarColor }} />
                            </div>
                            <div className={`text-xs ${scoreColor}`}>
                                {sustainabilityScore >= 70 ? '✅ Nachhaltig' : sustainabilityScore >= 40 ? '⚠️ Mäßig' : '❌ Wenig nachhaltig'}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-blue-300">
                        <div className="bg-white/10 rounded-lg px-2 py-1.5">
                            <div className="text-white font-bold text-xs">Dein Ergebnis</div>
                            <div>💰 {spielerTeam.guthaben.toLocaleString()}€</div>
                            <div>🏅 Platz {spielerRang} / 4</div>
                        </div>
                        <div className="bg-white/10 rounded-lg px-2 py-1.5">
                            <div className="text-white font-bold text-xs">Optimum (50%)</div>
                            <div>🐟 {optimal.endFischbestand}% Bestand</div>
                            <div>💰 {optimal.endGuthaben.toLocaleString()}€</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main 3-column section */}
            <div className="flex-1 min-h-0 grid grid-cols-3 gap-3">

                {/* Column 1: Leaderboard + Key Moments */}
                <div className="flex flex-col gap-3 min-h-0">

                    <div className="flex-none bg-white/10 rounded-xl p-4">
                        <h2 className="font-bold mb-3 text-sm">📊 Rangliste</h2>
                        <div className="space-y-2">
                            {sortedTeams.map((team, index) => (
                                <div key={team.name} className="flex justify-between items-center bg-white/10 rounded-lg px-3 py-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '4️⃣'}</span>
                                        <span>{team.farbe} {team.name}</span>
                                        <span className="text-xs text-blue-400">{team.istKI ? '🤖' : '👤'}</span>
                                    </div>
                                    <span className="font-bold text-xs">{team.guthaben.toLocaleString()}€</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 bg-white/10 rounded-xl p-4 overflow-hidden">
                        <h2 className="font-bold mb-3 text-sm">🔍 Schlüsselmomente</h2>
                        <div className="space-y-2">
                            {niedrigsterBestand.runde > 0 && (
                                <div className="flex items-start gap-2 bg-red-500/10 rounded-lg p-2.5">
                                    <span className="text-lg shrink-0">📉</span>
                                    <div>
                                        <div className="font-bold text-xs">Tiefster Fischbestand</div>
                                        <div className="text-blue-300 text-xs">Runde {niedrigsterBestand.runde}: nur {niedrigsterBestand.wert}% verblieben</div>
                                    </div>
                                </div>
                            )}
                            {groessterEinzelAbfall.runde > 0 && (
                                <div className="flex items-start gap-2 bg-orange-500/10 rounded-lg p-2.5">
                                    <span className="text-lg shrink-0">⚡</span>
                                    <div>
                                        <div className="font-bold text-xs">Größter Einzel-Rückgang</div>
                                        <div className="text-blue-300 text-xs">Runde {groessterEinzelAbfall.runde}: −{groessterEinzelAbfall.delta}% in einer Runde</div>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-start gap-2 bg-blue-500/10 rounded-lg p-2.5">
                                <span className="text-lg shrink-0">🎯</span>
                                <div>
                                    <div className="font-bold text-xs">Endstand</div>
                                    <div className="text-blue-300 text-xs">
                                        {gameState.fischbestand}% Bestand – {kollabiert ? 'kollabiert' : gameState.fischbestand >= 50 ? 'erhalten' : 'knapp'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 2: Charts */}
                <div className="flex flex-col gap-3 min-h-0">

                    <div className="flex-1 min-h-0 bg-white/10 rounded-xl p-4 flex flex-col">
                        <h2 className="flex-none font-bold text-sm mb-1">📈 Fischbestand & Guthaben</h2>
                        <p className="flex-none text-blue-300 text-xs mb-2">Verlauf über alle Runden</p>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={gameState.verlauf} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="runde" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10 }} />
                                    <YAxis yAxisId="left" domain={[0, 100]} stroke="#22c55e" tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} width={35} />
                                    <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.3)" tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 10 }} width={38} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e3a8a', border: 'none', borderRadius: '8px', fontSize: 11 }}
                                        formatter={(value, name) => name === 'Fischbestand %' ? [`${value}%`, name] : [`${value.toLocaleString()}€`, name]}
                                    />
                                    <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }} />
                                    <Line yAxisId="left" type="monotone" dataKey="fischbestand" stroke="#22c55e" strokeWidth={2} name="Fischbestand %" dot={false} />
                                    {gameState.teams.map((team, i) => (
                                        <Line
                                            key={team.name}
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey={d => d[team.name]}
                                            stroke={teamColors[i]}
                                            strokeWidth={1.5}
                                            strokeDasharray="5 3"
                                            name={`${team.name} €`}
                                            dot={false}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="h-44 bg-white/10 rounded-xl p-4 flex flex-col">
                        <h2 className="flex-none font-bold text-sm mb-1">💰 Endguthaben Vergleich</h2>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={guthabenDaten} margin={{ top: 2, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 10 }} />
                                    <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 10 }} width={35} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e3a8a', border: 'none', borderRadius: '8px', fontSize: 11 }} formatter={v => [`${v.toLocaleString()}€`, 'Guthaben']} />
                                    <Bar dataKey="Guthaben" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Column 3: Learning + Restart */}
                <div className="flex flex-col gap-3 min-h-0">

                    <div className="flex-1 min-h-0 bg-white/10 rounded-xl p-4 overflow-hidden flex flex-col">
                        <h2 className="flex-none font-bold text-sm mb-3">🎓 Lernreflexion</h2>
                        <div className="flex-1 min-h-0 space-y-2 overflow-hidden">
                            {kollabiert && (
                                <div className="bg-red-500/20 rounded-xl p-3">
                                    <div className="font-bold text-sm mb-1">💀 Tragedy of the Commons</div>
                                    <p className="text-xs text-blue-200">
                                        Jedes Team handelte rational für sich – aber gemeinsam wurde die Ressource zerstört.
                                        Genau das beschrieb Garrett Hardin 1968.
                                    </p>
                                </div>
                            )}
                            {!kollabiert && gameState.fischbestand < 30 && (
                                <div className="bg-orange-500/20 rounded-xl p-3">
                                    <div className="font-bold text-sm mb-1">⚠️ Knapp dem Kollaps entgangen</div>
                                    <p className="text-xs text-blue-200">
                                        Der Bestand war gefährdet. Ohne Verhaltensänderung wäre es zum Kollaps gekommen.
                                    </p>
                                </div>
                            )}
                            {!kollabiert && gameState.fischbestand >= 30 && (
                                <div className="bg-green-500/20 rounded-xl p-3">
                                    <div className="font-bold text-sm mb-1">✅ Nachhaltig gewirtschaftet</div>
                                    <p className="text-xs text-blue-200">
                                        Der Fischbestand wurde erhalten. Koordination und Zurückhaltung verhindern den Kollaps.
                                    </p>
                                </div>
                            )}
                            <div className="bg-white/10 rounded-xl p-3">
                                <div className="font-bold text-sm mb-1">📚 Elinor Ostrom (1990)</div>
                                <p className="text-xs text-blue-200">
                                    Nobelpreisträgerin: Gemeinschaften können Kollaps durch lokale Governance-Regeln verhindern –
                                    ohne Privatisierung oder staatliche Kontrolle.
                                </p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-3">
                                <div className="font-bold text-sm mb-1">🔄 Feedback-Delay</div>
                                <p className="text-xs text-blue-200">
                                    Der wahre Fischbestand war nie vollständig sichtbar. Erst sinkende Fänge
                                    signalisierten das Problem – oft zu spät.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-none">
                        <button
                            onClick={onRestart}
                            className="w-full bg-green-500 hover:bg-green-400 font-bold py-4 rounded-xl text-lg transition-colors"
                        >
                            🔄 Nochmal spielen
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EndPage
