const STORAGE_KEY = 'fishbanks_admin'

export const ADMIN_DEFAULTS = {
  numTeams: 4,
  startBoote: 3,
  maxRunden: 20,
  fishPrice: 20,
  newShipPrice: 300,
  interestRate: 0.02,
  harborCost: 50,
  coastalCost: 150,
  deepSeaCost: 250,
  startingCapital: 5000,
  maxFishPopulation: 6000,
  startingFishStock: 4000,
  fishReproductionRate: 0.05,
  schwierigkeitsgrad: 'leicht',
  aiDifficulties: [null, 'easy', 'easy', 'easy'],
  aiPersonalities: ['gierig', 'gierig', 'gierig', 'gierig'],
  showFishStock: true,
  showOtherCatches: true,
}

export function getAdminSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { ...ADMIN_DEFAULTS, aiDifficulties: [...ADMIN_DEFAULTS.aiDifficulties] }
    const parsed = JSON.parse(stored)
    return {
      ...ADMIN_DEFAULTS,
      ...parsed,
      aiDifficulties: ADMIN_DEFAULTS.aiDifficulties.map((d, i) =>
        parsed.aiDifficulties?.[i] ?? d
      ),
      aiPersonalities: ADMIN_DEFAULTS.aiPersonalities.map((d, i) =>
        parsed.aiPersonalities?.[i] ?? d
      ),
    }
  } catch {
    return { ...ADMIN_DEFAULTS, aiDifficulties: [...ADMIN_DEFAULTS.aiDifficulties] }
  }
}

export function saveAdminSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function resetAdminSettings() {
  localStorage.removeItem(STORAGE_KEY)
}

export function hasNonDefaultSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return false
    const s = JSON.parse(stored)
    const d = ADMIN_DEFAULTS
    for (const key of Object.keys(d)) {
      if (!(key in s)) continue
      if (key === 'aiDifficulties') {
        if (s[key]?.some((v, i) => v !== d[key][i])) return true
        continue
      }
      if (s[key] !== d[key]) return true
    }
    return false
  } catch {
    return false
  }
}
