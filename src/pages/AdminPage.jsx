import { useState } from 'react'
import { getAdminSettings, saveAdminSettings, resetAdminSettings, ADMIN_DEFAULTS } from '../game/adminSettings'

const TEAM_COLORS = ['🔴', '🟡', '🟢', '🔵']
const PERSONALITIES = ['gierig', 'kooperativ', 'rational']
const PERSONALITY_LABEL = { gierig: 'Greedy', kooperativ: 'Cooperative', rational: 'Rational' }

function Section({ title, children }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white leading-tight">{label}</div>
        {hint && <div className="text-xs text-blue-400 mt-0.5">{hint}</div>}
      </div>
      <div className="flex-none">{children}</div>
    </div>
  )
}

function NumInput({ value, onChange, min, max, step = 1, prefix = '', suffix = '' }) {
  return (
    <div className="flex items-center gap-1.5">
      {prefix && <span className="text-blue-300 text-xs">{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={e => {
          const v = step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value)
          if (!isNaN(v) && v >= min && v <= max) onChange(v)
        }}
        min={min}
        max={max}
        step={step}
        className="w-24 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white text-sm text-right focus:outline-none focus:border-blue-400 transition-colors"
      />
      {suffix && <span className="text-blue-300 text-xs">{suffix}</span>}
    </div>
  )
}

function BtnGroup({ value, options, onChange }) {
  return (
    <div className="flex gap-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            value === opt.value
              ? 'bg-green-500 text-white'
              : 'bg-white/10 hover:bg-white/20 text-blue-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function AdminPage({ onBack }) {
  const [settings, setSettings] = useState(() => getAdminSettings())

  function set(key, value) {
    setSettings(s => ({ ...s, [key]: value }))
  }

  function setPersonality(slot, value) {
    setSettings(s => {
      const p = [...s.aiPersonalities]
      p[slot] = value
      return { ...s, aiPersonalities: p }
    })
  }

  function handleReset() {
    resetAdminSettings()
    setSettings({ ...ADMIN_DEFAULTS, aiPersonalities: [...ADMIN_DEFAULTS.aiPersonalities] })
  }

  function handleSave() {
    saveAdminSettings(settings)
    onBack()
  }

  // ── Settings panel ────────────────────────────────────────────────────────
  const maxFish = settings.maxFishPopulation

  return (
    <div className="w-full h-full bg-blue-900 text-white flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex-none flex items-center justify-between px-6 py-3.5 border-b border-white/10 bg-blue-950/40">
        <div className="flex items-center gap-3">
          <span className="text-base">⚙</span>
          <div>
            <h1 className="font-bold text-sm leading-tight">Instructor Settings</h1>
            <p className="text-blue-400 text-xs">Configures defaults for all game sessions on this device</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-medium transition-colors"
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-500 hover:bg-green-400 rounded-xl text-xs font-bold transition-colors"
          >
            Save & Return
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">

          {/* Left column */}
          <div className="space-y-4">

            <Section title="Game Settings">
              <Row label="Number of teams" hint="Empty slots are filled by AI">
                <BtnGroup
                  value={settings.numTeams}
                  options={[{value:2,label:'2'},{value:3,label:'3'},{value:4,label:'4'}]}
                  onChange={v => set('numTeams', v)}
                />
              </Row>
              <Row label="Starting fleet" hint={`Default: ${ADMIN_DEFAULTS.startBoote} ships/team`}>
                <NumInput value={settings.startBoote} onChange={v => set('startBoote', v)} min={1} max={10} suffix="ships" />
              </Row>
              <Row label="Number of rounds" hint="Game length">
                <BtnGroup
                  value={settings.maxRunden}
                  options={[{value:10,label:'10'},{value:15,label:'15'},{value:20,label:'20'}]}
                  onChange={v => set('maxRunden', v)}
                />
              </Row>
            </Section>

            <Section title="Economics">
              <Row label="Fish price" hint={`Default: $${ADMIN_DEFAULTS.fishPrice}/fish`}>
                <NumInput value={settings.fishPrice} onChange={v => set('fishPrice', v)} min={1} max={200} prefix="$" suffix="/fish" />
              </Row>
              <Row label="New ship price (Shipyard)" hint={`Default: $${ADMIN_DEFAULTS.newShipPrice}`}>
                <NumInput value={settings.newShipPrice} onChange={v => set('newShipPrice', v)} min={50} max={2000} step={50} prefix="$" />
              </Row>
              <Row label="Interest rate" hint={`Default: ${ADMIN_DEFAULTS.interestRate * 100}%/round on min balance`}>
                <NumInput
                  value={Math.round(settings.interestRate * 1000) / 10}
                  onChange={v => set('interestRate', v / 100)}
                  min={0} max={20} step={0.5}
                  suffix="%"
                />
              </Row>
              <Row label="Harbor cost/ship" hint={`Default: $${ADMIN_DEFAULTS.harborCost}/round (no catch)`}>
                <NumInput value={settings.harborCost} onChange={v => set('harborCost', v)} min={0} max={500} step={5} prefix="$" suffix="/round" />
              </Row>
              <Row label="Coastal cost/ship" hint={`Default: $${ADMIN_DEFAULTS.coastalCost}/round (max 15 fish/ship)`}>
                <NumInput value={settings.coastalCost} onChange={v => set('coastalCost', v)} min={0} max={500} step={5} prefix="$" suffix="/round" />
              </Row>
              <Row label="Deep Sea cost/ship" hint={`Default: $${ADMIN_DEFAULTS.deepSeaCost}/round (max 25 fish/ship)`}>
                <NumInput value={settings.deepSeaCost} onChange={v => set('deepSeaCost', v)} min={0} max={500} step={5} prefix="$" suffix="/round" />
              </Row>
              <Row label="Starting capital" hint={`Default: $${ADMIN_DEFAULTS.startingCapital.toLocaleString()}/team`}>
                <NumInput value={settings.startingCapital} onChange={v => set('startingCapital', v)} min={500} max={50000} step={500} prefix="$" />
              </Row>
            </Section>

          </div>

          {/* Right column */}
          <div className="space-y-4">

            <Section title="Fish Population">
              <Row label="Max fish population" hint={`Default: ${ADMIN_DEFAULTS.maxFishPopulation.toLocaleString()} (carrying capacity)`}>
                <NumInput value={settings.maxFishPopulation} onChange={v => set('maxFishPopulation', Math.max(v, settings.startingFishStock))} min={1000} max={20000} step={500} />
              </Row>
              <Row label="Starting fish stock" hint={`Default: ${ADMIN_DEFAULTS.startingFishStock.toLocaleString()} (capped to max)`}>
                <NumInput
                  value={Math.min(settings.startingFishStock, maxFish)}
                  onChange={v => set('startingFishStock', Math.min(v, maxFish))}
                  min={100} max={maxFish} step={100}
                />
              </Row>
              <Row label="Reproduction rate" hint={`Default: ${ADMIN_DEFAULTS.fishReproductionRate * 100}%/round (logistic growth)`}>
                <NumInput
                  value={Math.round(settings.fishReproductionRate * 1000) / 10}
                  onChange={v => set('fishReproductionRate', v / 100)}
                  min={1} max={30} step={0.5}
                  suffix="%"
                />
              </Row>
            </Section>

            <Section title="AI Settings">
              <Row label="AI difficulty" hint="Applies to all AI-controlled slots">
                <BtnGroup
                  value={settings.schwierigkeitsgrad}
                  options={[{value:'leicht',label:'Easy'},{value:'schwer',label:'Hard'}]}
                  onChange={v => set('schwierigkeitsgrad', v)}
                />
              </Row>
              {[1, 2, 3].map(slot => (
                <Row
                  key={slot}
                  label={`${TEAM_COLORS[slot]} Slot ${slot + 1} personality`}
                  hint="Only active if this slot has no human player"
                >
                  <BtnGroup
                    value={settings.aiPersonalities[slot] || 'gierig'}
                    options={PERSONALITIES.map(p => ({ value: p, label: PERSONALITY_LABEL[p] }))}
                    onChange={v => setPersonality(slot, v)}
                  />
                </Row>
              ))}
            </Section>

            <Section title="Display (Information Asymmetry)">
              <Row label="Fish stock visible to players" hint="Hide for advanced sessions: players can only infer stock from catch rates">
                <BtnGroup
                  value={settings.showFishStock ? 'show' : 'hide'}
                  options={[{value:'show',label:'Show'},{value:'hide',label:'Hide'}]}
                  onChange={v => set('showFishStock', v === 'show')}
                />
              </Row>
              <Row label="Other teams' results visible" hint="Hide so each team only sees their own round summary">
                <BtnGroup
                  value={settings.showOtherCatches ? 'show' : 'hide'}
                  options={[{value:'show',label:'Show'},{value:'hide',label:'Hide'}]}
                  onChange={v => set('showOtherCatches', v === 'show')}
                />
              </Row>
            </Section>

          </div>
        </div>
      </div>
    </div>
  )
}
