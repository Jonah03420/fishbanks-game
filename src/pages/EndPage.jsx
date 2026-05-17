import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { GAME_CONFIG, berechneFischbestand, berechneFang, berechneGewinn } from '../game/fishLogic'

function berechneOptimalesErgebnis(maxRunden, startFischbestand) {
    // Simuliert alle 4 Teams bei 50% Kapazität (5 Boote × 50% = 2-3 Boote je Team)
    let fischbestand = startFischbestand
    let totalGuthaben = GAME_CONFIG.startGuthaben
    const verlauf = []

    for (let r = 1; r <= maxRunden && fischbestand > 0; r++) {
        const bootsAnzahl = 5
        const ausgesandt = Math.floor(bootsAnzahl * 0.5)
        const gesamteBoote = ausgesandt * 4
        const fang = berechneFang(ausgesandt, fischbestand, gesamteBoote)
        const gewinn = berechneGewinn(fang, ausgesandt)
        totalGuthaben += gewinn
        fischbestand = berechneFischbestand(fischbestand, gesamteBoote)
        verlauf.push({ runde: r, fischbestand })
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

    // Spieler-Rang
    const sortedTeams = [...gameState.teams].sort((a, b) => b.guthaben - a.guthaben)
    const spielerRang = sortedTeams.findIndex(t => !t.istKI) + 1
    const spielerTeam = gameState.teams[0]

    // Sustainability Score: 40% Fischbestand + 60% Guthaben-Rang
    const fischScore = gameState.fischbestand * 0.4
    const rangScore = ((4 - spielerRang + 1) / 4) * 100 * 0.6
    const sustainabilityScore = Math.round(fischScore + rangScore)

    // Optimales Ergebnis simulieren
    const optimal = berechneOptimalesErgebnis(maxRunden, GAME_CONFIG.startFischbestand)

    // Key Moments aus verlauf
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
    const scoreBg = sustainabilityScore >= 70 ? 'bg-green-500/20' : sustainabilityScore >= 40 ? 'bg-yellow-500/20' : 'bg-red-500/20'

    return (
        <div className="min-h-screen bg-blue-900 p-4 sm:p-6">
            <div className="max-w-3xl mx-auto">

                {/* Titel */}
                <div className="text-center mb-8 text-white">
                    <div className="text-6xl mb-4">{kollabiert ? '💀' : '🏆'}</div>
                    <h1 className="text-3xl font-bold mb-2">
                        {kollabiert ? 'Fischbestand kollabiert!' : 'Spiel beendet!'}
                    </h1>
                    <p className="text-blue-200">
                        {kollabiert
                            ? 'Überfischung hat den Bestand vernichtet – Tragedy of the Commons.'
                            : `Verbleibender Fischbestand: ${gameState.fischbestand}%`}
                    </p>
                </div>

                {/* Gewinner */}
                <div className="bg-yellow-500/20 rounded-xl p-4 mb-6 text-center text-white">
                    <div className="text-sm text-yellow-200 mb-1">🏆 Gewinner</div>
                    <div className="text-2xl font-bold">{winner.farbe} {winner.name}</div>
                    <div className="text-yellow-200">💰 {winner.guthaben.toLocaleString()}€</div>
                </div>

                {/* Sustainability Score */}
                <div className={`${scoreBg} rounded-2xl p-6 mb-6 text-white border border-white/10`}>
                    <h2 className="font-bold text-lg mb-3">🌿 Nachhaltigkeitsbewertung</h2>
                    <div className="flex items-center gap-6">
                        <div className={`text-6xl font-bold ${scoreColor}`}>{sustainabilityScore}</div>
                        <div className="flex-1">
                            <div className="text-blue-200 text-sm mb-2">von 100 Punkten (40% Fischbestand + 60% Guthaben-Rang)</div>
                            <div className="w-full bg-white/20 rounded-full h-3">
                                <div
                                    className="h-3 rounded-full transition-all duration-1000"
                                    style={{ width: `${sustainabilityScore}%`, backgroundColor: sustainabilityScore >= 70 ? '#22c55e' : sustainabilityScore >= 40 ? '#f59e0b' : '#ef4444' }}
                                />
                            </div>
                            <div className={`text-sm mt-1 ${scoreColor}`}>
                                {sustainabilityScore >= 70 ? '✅ Nachhaltig gewirtschaftet' : sustainabilityScore >= 40 ? '⚠️ Mäßige Nachhaltigkeitsbilanz' : '❌ Wenig nachhaltig'}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4 text-sm text-blue-300">
                        <div className="bg-white/10 rounded-xl p-3">
                            <div className="text-white font-bold">Dein Endguthaben</div>
                            <div>💰 {spielerTeam.guthaben.toLocaleString()}€</div>
                            <div>🏅 Platz {spielerRang} von 4</div>
                        </div>
                        <div className="bg-white/10 rounded-xl p-3">
                            <div className="text-white font-bold">Theoretisches Optimum</div>
                            <div>🐟 {optimal.endFischbestand}% Fischbestand</div>
                            <div>💰 {optimal.endGuthaben.toLocaleString()}€ (50%-Strategie)</div>
                        </div>
                    </div>
                </div>

                {/* Schlüsselmomente */}
                {gameState.verlauf.length > 1 && (
                    <div className="bg-white/10 rounded-2xl p-6 mb-6 text-white">
                        <h2 className="font-bold text-lg mb-4">🔍 Schlüsselmomente</h2>
                        <div className="space-y-3">
                            {niedrigsterBestand.runde > 0 && (
                                <div className="flex items-start gap-3 bg-red-500/10 rounded-xl p-3">
                                    <span className="text-2xl">📉</span>
                                    <div>
                                        <div className="font-bold text-sm">Tiefster Fischbestand</div>
                                        <div className="text-blue-300 text-sm">Runde {niedrigsterBestand.runde}: nur {niedrigsterBestand.wert}% verblieben</div>
                                    </div>
                                </div>
                            )}
                            {groessterEinzelAbfall.runde > 0 && (
                                <div className="flex items-start gap-3 bg-orange-500/10 rounded-xl p-3">
                                    <span className="text-2xl">⚡</span>
                                    <div>
                                        <div className="font-bold text-sm">Größter Einzel-Rückgang</div>
                                        <div className="text-blue-300 text-sm">Runde {groessterEinzelAbfall.runde}: −{groessterEinzelAbfall.delta}% in einer Runde</div>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-start gap-3 bg-blue-500/10 rounded-xl p-3">
                                <span className="text-2xl">🎯</span>
                                <div>
                                    <div className="font-bold text-sm">Endstand</div>
                                    <div className="text-blue-300 text-sm">
                                        Nach {gameState.verlauf.length} Runden: {gameState.fischbestand}% Fischbestand – {kollabiert ? 'Bestand kollabiert' : gameState.fischbestand >= 50 ? 'Bestand erhalten' : 'Bestand knapp'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Rangliste */}
                <div className="bg-white/10 rounded-2xl p-6 mb-6 text-white">
                    <h2 className="font-bold text-lg mb-4">📊 Rangliste</h2>
                    {sortedTeams.map((team, index) => (
                        <div key={team.name} className="flex justify-between items-center bg-white/10 rounded-xl p-3 mb-2">
                            <div className="flex items-center gap-3">
                                <span className="text-xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '4️⃣'}</span>
                                <span>{team.farbe} {team.name}</span>
                                <span className="text-xs text-blue-300">{team.istKI ? '🤖 KI' : '👤 Spieler'}</span>
                            </div>
                            <span className="font-bold">💰 {team.guthaben.toLocaleString()}€</span>
                        </div>
                    ))}
                </div>

                {/* Fischbestand & Guthaben Verlauf */}
                {(() => {
                    return (
                        <div className="bg-white/10 rounded-2xl p-6 mb-6 text-white">
                            <h2 className="font-bold text-lg mb-1">📈 Fischbestand & Guthaben über alle Runden</h2>
                            <p className="text-blue-300 text-sm mb-4">Wie hat sich der Fischbestand und die Teamguthaben entwickelt?</p>
                            <ResponsiveContainer width="100%" height={280}>
                                <LineChart data={gameState.verlauf} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="runde" stroke="rgba(255,255,255,0.5)" label={{ value: 'Runde', position: 'insideBottomRight', offset: -5, fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                                    <YAxis yAxisId="left" domain={[0, 100]} stroke="#22c55e" tickFormatter={v => `${v}%`} width={40} />
                                    <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.3)" tickFormatter={v => `${Math.round(v / 1000)}k`} width={45} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e3a8a', border: 'none', borderRadius: '8px', fontSize: 12 }}
                                        formatter={(value, name) => name === 'Fischbestand %' ? [`${value}%`, name] : [`${value.toLocaleString()}€`, name]}
                                    />
                                    <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                                    <Line yAxisId="left" type="monotone" dataKey="fischbestand" stroke="#22c55e" strokeWidth={2.5} name="Fischbestand %" dot={false} />
                                    {gameState.teams.map((team, i) => (
                                        <Line
                                            key={team.name}
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey={(d) => d[team.name]}
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
                    )
                })()}

                {/* Guthaben Vergleich */}
                <div className="bg-white/10 rounded-2xl p-6 mb-6 text-white">
                    <h2 className="font-bold text-lg mb-1">💰 Endguthaben Vergleich</h2>
                    <p className="text-blue-300 text-sm mb-4">Wer hat am meisten verdient?</p>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={guthabenDaten}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
                            <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={v => `${Math.round(v / 1000)}k`} />
                            <Tooltip contentStyle={{ backgroundColor: '#1e3a8a', border: 'none', borderRadius: '8px' }} formatter={v => [`${v.toLocaleString()}€`, 'Guthaben']} />
                            <Bar dataKey="Guthaben" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Lernreflexion */}
                <div className="bg-white/10 rounded-2xl p-6 mb-6 text-white">
                    <h2 className="font-bold text-lg mb-4">🎓 Lernreflexion</h2>
                    <div className="space-y-3">
                        {kollabiert && (
                            <div className="bg-red-500/20 rounded-xl p-4">
                                <strong>💀 Tragedy of the Commons eingetreten:</strong>
                                <p className="text-sm text-blue-200 mt-1">
                                    Jedes Team handelte rational für sich – aber gemeinsam wurde die Ressource zerstört.
                                    Niemand wollte den Kollaps, aber alle haben dazu beigetragen.
                                    Genau das beschrieb Garrett Hardin 1968.
                                </p>
                            </div>
                        )}
                        {!kollabiert && gameState.fischbestand < 30 && (
                            <div className="bg-orange-500/20 rounded-xl p-4">
                                <strong>⚠️ Knapp dem Kollaps entgangen:</strong>
                                <p className="text-sm text-blue-200 mt-1">
                                    Der Bestand war gefährdet. Ohne Verhaltensänderung wäre es
                                    zum Kollaps gekommen. Koordination war entscheidend.
                                </p>
                            </div>
                        )}
                        {!kollabiert && gameState.fischbestand >= 30 && (
                            <div className="bg-green-500/20 rounded-xl p-4">
                                <strong>✅ Nachhaltig gewirtschaftet:</strong>
                                <p className="text-sm text-blue-200 mt-1">
                                    Der Fischbestand wurde erhalten. Das zeigt: Koordination und
                                    Zurückhaltung verhindern den Kollaps gemeinsamer Ressourcen.
                                </p>
                            </div>
                        )}
                        <div className="bg-white/10 rounded-xl p-4">
                            <strong>📚 Wissenschaftlicher Kontext:</strong>
                            <p className="text-sm text-blue-200 mt-1">
                                Elinor Ostrom zeigte 1990 (Nobelpreis), dass Gemeinschaften
                                Kollaps durch lokale Governance-Regeln verhindern können –
                                ohne Privatisierung oder staatliche Kontrolle.
                            </p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-4">
                            <strong>🔄 Feedback-Delay:</strong>
                            <p className="text-sm text-blue-200 mt-1">
                                Der wahre Fischbestand war nie vollständig sichtbar.
                                Erst sinkende Fänge signalisierten das Problem –
                                oft zu spät für eine Korrektur.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Neustart */}
                <button
                    onClick={onRestart}
                    className="w-full bg-green-500 hover:bg-green-400 font-bold py-4 rounded-xl text-xl transition-colors text-white mb-6"
                >
                    🔄 Nochmal spielen
                </button>

            </div>
        </div>
    )
}

export default EndPage
