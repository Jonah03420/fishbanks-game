// Spielkonstanten – aligned with MIT Fish Banks values
export const GAME_CONFIG = {
  maxRunden: 20,
  startFischbestand: 4000,   // actual fish count
  maxFischbestand: 6000,
  wachstumsRate: 0.05,
  startGuthaben: 5000,
  initialBoote: 3,           // ships per team at start (MIT standard)
  bootKosten: 300,           // new ship order price (shipyard)
  auctionPreis: 500,         // auction market price for buying/selling ships
  bootVerkaufswert: 500,     // = auctionPreis
  fischPreis: 20,            // $/fish
  betriebskosten: 75,        // $/ship/round (instructor-configurable in MIT)
  zinsRate: 0.02,            // 2%/round interest on minimum balance
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function clampBoote(value, max) {
  return Math.max(0, Math.min(max, Math.round(value)))
}

// Ship effectiveness per ship per round — nonlinear per MIT model.
// deepSea max = 25 fish/ship at full stock; falls with sqrt(density).
function shipEffectiveness(fischDichte) {
  return 25 * Math.sqrt(Math.max(0, fischDichte))
}

// ─── Core game functions ──────────────────────────────────────────────────────

// Logistic growth after total catch is removed.
// gesamtFang: total fish caught by ALL teams this round (already capped to current stock).
export function berechneFischbestand(aktuellerBestand, gesamtFang) {
  const wachstum = GAME_CONFIG.wachstumsRate
    * aktuellerBestand
    * (1 - aktuellerBestand / GAME_CONFIG.maxFischbestand)
  const neuerBestand = aktuellerBestand - gesamtFang + wachstum
  return Math.min(GAME_CONFIG.maxFischbestand, Math.max(0, Math.round(neuerBestand)))
}

// Per-team catch: each deployed ship catches based on current fish density.
// No share-denominator — competition is via stock depletion across rounds.
export function berechneFang(ausgesandteBoote, fischbestand) {
  if (ausgesandteBoote === 0) return 0
  const fischDichte = fischbestand / GAME_CONFIG.maxFischbestand
  return Math.round(ausgesandteBoote * shipEffectiveness(fischDichte))
}

// Net profit = fish revenue - operating costs (interest handled separately).
export function berechneGewinn(fang, ausgesandteBoote, preisMultiplikator = 1.0) {
  const einnahmen = fang * GAME_CONFIG.fischPreis * preisMultiplikator
  const kosten = ausgesandteBoote * GAME_CONFIG.betriebskosten
  return einnahmen - kosten
}

// Weather factor for one round (±10%), applied to catch per MIT spec.
// One roll per round, same value used by all teams.
export function erzeugeMarktereignis() {
  return rand(0.90, 1.10)
}

export function berechneNetWorth(bankBalance, boote, shipPrice) {
  return bankBalance + (boote * shipPrice)
}

// ─── Leicht ──────────────────────────────────────────────────────────────────

export function kiBootAktionLeicht(team, verkaufPreis = GAME_CONFIG.bootVerkaufswert) {
  const { boote, guthaben } = team
  const r = Math.random()
  if (r > 0.93 && guthaben >= GAME_CONFIG.bootKosten && boote < 7) {
    return { boote: boote + 1, guthaben: guthaben - GAME_CONFIG.bootKosten }
  }
  if (r < 0.04 && boote > 2) {
    return { boote: boote - 1, guthaben: guthaben + verkaufPreis }
  }
  return { boote, guthaben }
}

export function kiAusgesandtLeicht(boote) {
  return clampBoote(boote * rand(0.10, 0.70), boote)
}

// ─── Schwer ──────────────────────────────────────────────────────────────────

// Average fish stock change per round over last 1–3 rounds (negative = declining).
// Values are now in actual fish count (0–6000 scale).
function berechneTrend(verlauf) {
  if (verlauf.length < 2) return 0
  const recent = verlauf.slice(-3)
  let delta = 0
  for (let i = 1; i < recent.length; i++) {
    delta += recent[i].fischbestand - recent[i - 1].fischbestand
  }
  return delta / (recent.length - 1)
}

// Grid-search: find profit-maximising boat count.
// With the linear per-ship catch formula, profit is linear in b → result is 0 or max.
function bestResponse(meineMaxBoote, andereBoote, fischbestand) {
  const fischDichte = fischbestand / GAME_CONFIG.maxFischbestand
  const eff = shipEffectiveness(fischDichte)
  let bestBoote = 0
  let bestGewinn = 0
  for (let b = 1; b <= meineMaxBoote; b++) {
    const meinFang = b * eff
    const gewinn = meinFang * GAME_CONFIG.fischPreis - b * GAME_CONFIG.betriebskosten
    if (gewinn > bestGewinn) {
      bestGewinn = gewinn
      bestBoote = b
    }
  }
  return bestBoote
}

function andereBooteGeschaetzt(meineTeamName, alleTeams) {
  return alleTeams
    .filter(t => t.name !== meineTeamName)
    .reduce((sum, t) => sum + (t.ausgesandteBoote || 3), 0)
}

export function kiBootAktionSchwer(team, fischbestand, verlauf, alleTeams, verkaufPreis = GAME_CONFIG.bootVerkaufswert) {
  let { boote, guthaben, persoenlichkeit, name } = team
  const trend = berechneTrend(verlauf)

  // Panic selling: 8% chance when trend is sharply negative (−300 = −5% of 6000)
  // and stock is low (< 2400 = 40%)
  if (trend < -300 && fischbestand < 2400 && boote > 3 && Math.random() < 0.08) {
    return { boote: boote - 1, guthaben: guthaben + verkaufPreis }
  }

  const andereGeschaetzt = andereBooteGeschaetzt(name, alleTeams)

  function expectedProfit(meineBoote) {
    if (meineBoote === 0) return 0
    const opt = bestResponse(meineBoote, andereGeschaetzt, fischbestand)
    const fischDichte = fischbestand / GAME_CONFIG.maxFischbestand
    const meinFang = opt * shipEffectiveness(fischDichte)
    return meinFang * GAME_CONFIG.fischPreis - opt * GAME_CONFIG.betriebskosten
  }

  const marginalROI = (expectedProfit(boote + 1) - expectedProfit(boote)) * rand(0.85, 1.15)

  // Scaled kaufSchwelle: gierig=30, rational=150, kooperativ=250
  const kaufSchwelle = (persoenlichkeit === 'gierig' ? 30 : persoenlichkeit === 'rational' ? 150 : 250) * rand(0.90, 1.10)
  // verkaufTrendSchwelle: cooperativ=−180 (−3%), rational=−300 (−5%), gierig=−480 (−8%)
  const verkaufTrendSchwelle = persoenlichkeit === 'kooperativ' ? -180 : persoenlichkeit === 'rational' ? -300 : -480

  // fischbestand > 2100 = 35%, trend >= -120 = -2%
  if (marginalROI > kaufSchwelle && guthaben >= GAME_CONFIG.bootKosten && fischbestand > 2100 && trend >= -120 && boote < 10) {
    boote += 1
    guthaben -= GAME_CONFIG.bootKosten
  } else if (trend < verkaufTrendSchwelle && boote > 3) {
    boote -= 1
    guthaben += verkaufPreis
  }

  return { boote, guthaben }
}

// Zone allocation for AI teams based on personality and fish density.
// Returns { harborBoote, coastalBoote, deepSeaBoote } summing to boote.
export function kiZoneAllokierung(persoenlichkeit, boote, ausgesandt, fischbestand) {
  const harbor = boote - ausgesandt
  if (persoenlichkeit === 'gierig') {
    // All deployed ships to Deep Sea — maximum yield
    return { harborBoote: harbor, coastalBoote: 0, deepSeaBoote: ausgesandt }
  } else if (persoenlichkeit === 'kooperativ') {
    // Deployed ships go to Coastal — gentler on the stock
    return { harborBoote: harbor, coastalBoote: ausgesandt, deepSeaBoote: 0 }
  } else { // rational — always reserve 1 in Harbor, split rest by density
    const adjustedHarbor = Math.max(harbor, Math.min(1, boote))
    const remaining = boote - adjustedHarbor
    const fishDichte = fischbestand / GAME_CONFIG.maxFischbestand
    if (fishDichte > 0.5) {
      return { harborBoote: adjustedHarbor, coastalBoote: 0, deepSeaBoote: remaining }
    } else {
      return { harborBoote: adjustedHarbor, coastalBoote: remaining, deepSeaBoote: 0 }
    }
  }
}

export function kiAusgesandtSchwer(persoenlichkeit, teamName, boote, fischbestand, verlauf, alleTeams) {
  const trend = berechneTrend(verlauf)
  const andereGeschaetzt = andereBooteGeschaetzt(teamName, alleTeams)

  let optimal = bestResponse(boote, andereGeschaetzt, fischbestand)

  if (persoenlichkeit === 'gierig') {
    optimal = Math.min(boote, optimal + 1)
  } else if (persoenlichkeit === 'kooperativ' && trend < -180) {  // trend < -3% of 6000
    optimal = Math.max(0, optimal - 1)
  }

  optimal = Math.round(optimal * rand(0.90, 1.10))

  // Hard collapse prevention: < 900 = 15% of 6000
  if (fischbestand < 900) {
    optimal = Math.min(optimal, Math.max(0, Math.floor(boote * 0.2)))
  }

  return Math.max(0, Math.min(boote, optimal))
}
