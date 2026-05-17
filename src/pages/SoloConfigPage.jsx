import { useState } from 'react'
import { GAME_CONFIG } from '../game/fishLogic'

const START_BOOTE = 5

const DIFFICULTIES = [
  {
    id: 'leicht',
    icon: '🟢',
    label: 'Leicht',
    desc: 'KI fischt zurückhaltend (10–70% Varianz), reagiert kaum auf Bestandsveränderungen',
    kiNote: 'Zufälliges, wenig adaptives Verhalten',
  },
  {
    id: 'mittel',
    icon: '🟡',
    label: 'Mittel',
    desc: 'Gemischte Strategien: Gierig, Kooperativ, Rational – Standard-Verhalten',
    kiNote: 'Drei verschiedene KI-Persönlichkeiten',
  },
  {
    id: 'schwer',
    icon: '🔴',
    label: 'Schwer',
    desc: 'Nash-Gleichgewicht, adaptive Flottensteuerung, optimiert jeden Zug',
    kiNote: 'Vollständig adaptiv – maximiert Gewinn',
  },
]

const RUNDEN_OPTIONS = [
  { r: 10, label: 'Schnell', desc: '~10 Minuten' },
  { r: 15, label: 'Mittel',  desc: '~15 Minuten' },
  { r: 20, label: 'Standard', desc: '~20 Minuten' },
]

function SoloConfigPage({ onStart, onBack }) {
  const [playerName, setPlayerName] = useState('')
  const [maxRunden, setMaxRunden] = useState(20)
  const [schwierigkeit, setSchwierigkeit] = useState('mittel')

  const diff = DIFFICULTIES.find(d => d.id === schwierigkeit)

  return (
    <div className="w-full h-full bg-blue-900 text-white flex overflow-hidden">

      {/* Left panel — game preview / info */}
      <div className="flex-1 flex flex-col justify-center px-16 py-12 bg-gradient-to-br from-blue-800 to-blue-950 gap-6">
        <div>
          <h2 className="text-3xl font-bold mb-1">Wie es funktioniert</h2>
          <p className="text-blue-300 text-sm">Jede Runde triffst du zwei Entscheidungen.</p>
        </div>

        <div className="space-y-4">
          <div className="bg-white/10 rounded-2xl p-5 flex gap-4 items-start">
            <div className="text-3xl shrink-0">🚢</div>
            <div>
              <div className="font-bold mb-1">Flotte verwalten</div>
              <div className="text-blue-300 text-sm">
                Starte mit {START_BOOTE} Booten und {GAME_CONFIG.startGuthaben.toLocaleString()}€.
                Kaufe neue Boote für {GAME_CONFIG.bootKosten.toLocaleString()}€ oder verkaufe sie für {GAME_CONFIG.bootVerkaufswert.toLocaleString()}€.
              </div>
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-5 flex gap-4 items-start">
            <div className="text-3xl shrink-0">🎣</div>
            <div>
              <div className="font-bold mb-1">Boote aussenden</div>
              <div className="text-blue-300 text-sm">
                Entscheide, wie viele Boote du in diese Runde schickst.
                Mehr Boote = mehr Fang – aber auch mehr Druck auf den Bestand.
              </div>
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-5 flex gap-4 items-start">
            <div className="text-3xl shrink-0">🌊</div>
            <div>
              <div className="font-bold mb-1">Bestand schützen</div>
              <div className="text-blue-300 text-sm">
                Fischbestand unter 40%? Gefährlich. Unter 0%? Kollaps – alle verlieren.
                Der Bestand erholt sich, wenn weniger gefischt wird.
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <div className="text-sm font-bold mb-3 text-blue-200">Aktuelle Auswahl</div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="bg-white/10 rounded-xl p-3">
              <div className="text-xl mb-1">{diff?.icon}</div>
              <div className="font-bold">{diff?.label}</div>
              <div className="text-blue-300 text-xs mt-0.5">{diff?.kiNote}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <div className="text-xl mb-1">🔄</div>
              <div className="font-bold">{maxRunden} Runden</div>
              <div className="text-blue-300 text-xs mt-0.5">{RUNDEN_OPTIONS.find(o => o.r === maxRunden)?.desc}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <div className="text-xl mb-1">👤</div>
              <div className="font-bold truncate">{playerName.trim() || 'Team A'}</div>
              <div className="text-blue-300 text-xs mt-0.5">Dein Teamname</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — config form */}
      <div className="w-[420px] flex flex-col justify-center px-10 py-12 bg-blue-950/60 border-l border-white/10 gap-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">⚙️ Spiel konfigurieren</h1>
          <p className="text-blue-300 text-sm">Solo gegen drei KI-Teams.</p>
        </div>

        <div>
          <label className="block text-sm text-blue-200 mb-2">👤 Dein Teamname</label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onStart(playerName.trim() || 'Team A', maxRunden, schwierigkeit)}
            placeholder="Team A"
            maxLength={20}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm text-blue-200 mb-2">🎯 Schwierigkeitsgrad</label>
          <div className="space-y-2">
            {DIFFICULTIES.map(d => (
              <button
                key={d.id}
                onClick={() => setSchwierigkeit(d.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
                  schwierigkeit === d.id
                    ? 'bg-white/20 ring-1 ring-white/30'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <span className="text-xl shrink-0">{d.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{d.label}</div>
                  <div className="text-xs text-blue-300 truncate">{d.desc}</div>
                </div>
                {schwierigkeit === d.id && <span className="text-green-400 shrink-0">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-blue-200 mb-2">🔄 Spiellänge</label>
          <div className="grid grid-cols-3 gap-2">
            {RUNDEN_OPTIONS.map(({ r, label, desc }) => (
              <button
                key={r}
                onClick={() => setMaxRunden(r)}
                className={`py-3 rounded-xl font-bold transition-colors ${maxRunden === r ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'}`}
              >
                {r} Runden
                <div className="text-xs font-normal mt-0.5">{label}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-auto">
          <button
            onClick={() => onStart(playerName.trim() || 'Team A', maxRunden, schwierigkeit)}
            className="w-full bg-green-500 hover:bg-green-400 font-bold py-4 rounded-xl text-xl transition-colors"
          >
            🎮 Spiel starten
          </button>
          <button
            onClick={onBack}
            className="w-full text-blue-300 hover:text-white text-sm transition-colors py-2"
          >
            ← Zurück
          </button>
        </div>
      </div>
    </div>
  )
}

export default SoloConfigPage
