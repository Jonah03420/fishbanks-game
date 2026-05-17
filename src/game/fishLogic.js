// Spielkonstanten
export const GAME_CONFIG = {
  maxRunden: 20,
  startFischbestand: 100,
  maxFischbestand: 100,
  wachstumsRate: 0.5,        // erhöht von 0.3
  startGuthaben: 50000,
  bootKosten: 5000,
  fischPreis: 1000,
  bootVerkaufswert: 3000,
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

// Uniform random float in [min, max)
function rand(min, max) {
  return min + Math.random() * (max - min)
}

// Round and clamp to integer in [0, max]
function clampBoote(value, max) {
  return Math.max(0, Math.min(max, Math.round(value)))
}

// ─── Core game functions ──────────────────────────────────────────────────────

export function berechneFischbestand(aktuellerBestand, gesamteBoote) {
  const fangRate = 1.5                                    // reduziert von 2
  const gefangen = Math.min(gesamteBoote * fangRate, aktuellerBestand * 0.4)  // max 40% pro Runde
  const verbleibend = aktuellerBestand - gefangen

  const wachstum = GAME_CONFIG.wachstumsRate
    * verbleibend
    * (1 - verbleibend / GAME_CONFIG.maxFischbestand)

  return Math.max(0, Math.round(verbleibend + wachstum))
}

export function berechneFang(ausgesandteBoote, fischbestand, gesamteBoote) {
  if (gesamteBoote === 0) return 0
  const anteil = ausgesandteBoote / gesamteBoote
  return Math.round(Math.min(gesamteBoote * 2, fischbestand) * anteil)
}

// preisMultiplikator: market event multiplier (default 1.0 = no change)
export function berechneGewinn(fang, ausgesandteBoote, preisMultiplikator = 1.0) {
  const einnahmen = fang * GAME_CONFIG.fischPreis * preisMultiplikator
  const kosten = ausgesandteBoote * 500 // Betriebskosten pro Boot
  return einnahmen - kosten
}

// Generates a random fish-price multiplier for one round (±20%).
// Applies equally to all teams — simulates market volatility.
export function erzeugeMarktereignis() {
  return rand(0.80, 1.20)
}

// ─── Leicht ──────────────────────────────────────────────────────────────────
// Wide random variance (10–70% capacity). Simulates an uninformed, inconsistent
// player who neither tracks fish stock nor manages their fleet sensibly.

export function kiBootAktionLeicht(team) {
  const { boote, guthaben } = team
  const r = Math.random()
  // 7% impulsive buy, ignoring all conditions
  if (r > 0.93 && guthaben >= GAME_CONFIG.bootKosten && boote < 7) {
    return { boote: boote + 1, guthaben: guthaben - GAME_CONFIG.bootKosten }
  }
  // 4% impulsive sell
  if (r < 0.04 && boote > 2) {
    return { boote: boote - 1, guthaben: guthaben + GAME_CONFIG.bootVerkaufswert }
  }
  return { boote, guthaben }
}

export function kiAusgesandtLeicht(boote) {
  // ±30% around 40% base → effective range 10%–70% of capacity
  return clampBoote(boote * rand(0.10, 0.70), boote)
}

// ─── Mittel ──────────────────────────────────────────────────────────────────
// ±20% variance on base rates. 10% chance of fully irrational action each round.
// Each personality has an additional quirk.

export function kiBootAktionMittel(team, fischbestand) {
  let { boote, guthaben } = team

  // 10% irrational: random buy or sell regardless of conditions
  if (Math.random() < 0.10) {
    const impulse = Math.random()
    if (impulse < 0.5 && guthaben >= GAME_CONFIG.bootKosten && boote < 7) {
      return { boote: boote + 1, guthaben: guthaben - GAME_CONFIG.bootKosten }
    }
    if (impulse >= 0.5 && boote > 2) {
      return { boote: boote - 1, guthaben: guthaben + GAME_CONFIG.bootVerkaufswert }
    }
    return { boote, guthaben }
  }

  if (team.persoenlichkeit === 'gierig') {
    // Buys 75% of the time when conditions are right (not always impulsive)
    if (fischbestand > 50 && guthaben >= GAME_CONFIG.bootKosten && Math.random() < 0.75) {
      boote += 1
      guthaben -= GAME_CONFIG.bootKosten
    }
  } else if (team.persoenlichkeit === 'kooperativ') {
    if (fischbestand < 25 && boote > 2 && Math.random() < 0.70) {
      boote -= 1
      guthaben += GAME_CONFIG.bootVerkaufswert
    }
    if (fischbestand > 75 && guthaben >= GAME_CONFIG.bootKosten && boote < 6 && Math.random() < 0.75) {
      boote += 1
      guthaben -= GAME_CONFIG.bootKosten
    }
  } else if (team.persoenlichkeit === 'rational') {
    // ±15% noise in the ROI estimate (imperfect information)
    const roiNoise = rand(0.85, 1.15)
    const erwarteterZusatzGewinn = (fischbestand / 20) * GAME_CONFIG.fischPreis * roiNoise - 500
    if (erwarteterZusatzGewinn > 0 && guthaben >= GAME_CONFIG.bootKosten && fischbestand > 40 && Math.random() < 0.85) {
      boote += 1
      guthaben -= GAME_CONFIG.bootKosten
    } else if (fischbestand < 30 && boote > 3 && Math.random() < 0.85) {
      boote -= 1
      guthaben += GAME_CONFIG.bootVerkaufswert
    }
  }

  return { boote, guthaben }
}

export function kiAusgesandtMittel(persoenlichkeit, fischbestand, boote) {
  // 10% fully irrational: random boats in [0, boote]
  if (Math.random() < 0.10) {
    return clampBoote(rand(0, boote), boote)
  }

  let base
  if (persoenlichkeit === 'gierig') {
    // 15% greed spike: sends exactly max regardless of variance
    if (Math.random() < 0.15) return boote
    base = boote // ±20% below will typically land at 80–100%
  } else if (persoenlichkeit === 'kooperativ') {
    // 8% defection: overfishes despite cooperative strategy
    if (Math.random() < 0.08) {
      return clampBoote(rand(boote * 0.75, boote), boote)
    }
    if (fischbestand > 60) base = boote * 0.55
    else if (fischbestand > 40) base = boote * 0.45
    else base = boote * 0.30
  } else {
    // rational: ±10% calculation error on the rate
    const rateNoise = rand(0.90, 1.10)
    if (fischbestand > 70) base = boote * 0.75 * rateNoise
    else if (fischbestand > 50) base = boote * 0.60 * rateNoise
    else if (fischbestand > 30) base = boote * 0.45 * rateNoise
    else base = boote * 0.35 * rateNoise
  }

  // ±20% variance on base decision
  return clampBoote(base * rand(0.80, 1.20), boote)
}

// ─── Schwer ──────────────────────────────────────────────────────────────────
// Near-optimal Nash equilibrium with ±10% execution variance. Personality still
// shapes behavior. Includes panic selling and noisy ROI estimates.

// Average fish stock change per round over last 1–3 rounds (negative = declining)
function berechneTrend(verlauf) {
  if (verlauf.length < 2) return 0
  const recent = verlauf.slice(-3)
  let delta = 0
  for (let i = 1; i < recent.length; i++) {
    delta += recent[i].fischbestand - recent[i - 1].fischbestand
  }
  return delta / (recent.length - 1)
}

// Grid-search: find my profit-maximising boat count given others send `andereBoote` total.
// Baseline is 0 boats (profit = 0); any option with lower profit loses.
function bestResponse(meineMaxBoote, andereBoote, fischbestand) {
  let bestBoote = 0
  let bestGewinn = 0
  for (let b = 1; b <= meineMaxBoote; b++) {
    const total = b + andereBoote
    const totalFang = Math.min(total * 1.5, fischbestand * 0.4)
    const meinFang = (b / total) * totalFang
    const gewinn = meinFang * GAME_CONFIG.fischPreis - b * 500
    if (gewinn > bestGewinn) {
      bestGewinn = gewinn
      bestBoote = b
    }
  }
  return bestBoote
}

// Estimate how many boats others will send by summing their last-round dispatch
function andereBooteGeschaetzt(meineTeamName, alleTeams) {
  return alleTeams
    .filter(t => t.name !== meineTeamName)
    .reduce((sum, t) => sum + (t.ausgesandteBoote || 3), 0)
}

export function kiBootAktionSchwer(team, fischbestand, verlauf, alleTeams) {
  let { boote, guthaben, persoenlichkeit, name } = team
  const trend = berechneTrend(verlauf)

  // Panic selling: 8% chance when trend is sharply negative and stock is low
  if (trend < -5 && fischbestand < 40 && boote > 3 && Math.random() < 0.08) {
    return { boote: boote - 1, guthaben: guthaben + GAME_CONFIG.bootVerkaufswert }
  }

  const andereGeschaetzt = andereBooteGeschaetzt(name, alleTeams)

  function expectedProfit(meineBoote) {
    if (meineBoote === 0) return 0
    const opt = bestResponse(meineBoote, andereGeschaetzt, fischbestand)
    const total = opt + andereGeschaetzt
    const fang = (opt / total) * Math.min(total * 1.5, fischbestand * 0.4)
    return fang * GAME_CONFIG.fischPreis - opt * 500
  }

  // ±15% noise on the marginal ROI estimate (imperfect market knowledge)
  const marginalROI = (expectedProfit(boote + 1) - expectedProfit(boote)) * rand(0.85, 1.15)

  // Personality thresholds with ±10% random variation each round
  const kaufSchwelle = (persoenlichkeit === 'gierig' ? 600 : persoenlichkeit === 'rational' ? 1200 : 2000) * rand(0.90, 1.10)
  const verkaufTrendSchwelle = persoenlichkeit === 'kooperativ' ? -3 : persoenlichkeit === 'rational' ? -5 : -8

  if (marginalROI > kaufSchwelle && guthaben >= GAME_CONFIG.bootKosten && fischbestand > 35 && trend >= -2) {
    boote += 1
    guthaben -= GAME_CONFIG.bootKosten
  } else if (trend < verkaufTrendSchwelle && boote > 3) {
    boote -= 1
    guthaben += GAME_CONFIG.bootVerkaufswert
  }

  return { boote, guthaben }
}

export function kiAusgesandtSchwer(persoenlichkeit, teamName, boote, fischbestand, verlauf, alleTeams) {
  const trend = berechneTrend(verlauf)
  const andereGeschaetzt = andereBooteGeschaetzt(teamName, alleTeams)

  let optimal = bestResponse(boote, andereGeschaetzt, fischbestand)

  // Personality adjustment on top of Nash equilibrium
  if (persoenlichkeit === 'gierig') {
    optimal = Math.min(boote, optimal + 1)        // push one extra boat aggressively
  } else if (persoenlichkeit === 'kooperativ' && trend < -3) {
    optimal = Math.max(0, optimal - 1)            // back off when stock declining
  }
  // rational: pure Nash, no modification

  // ±10% execution variance (imperfect timing, weather, crew availability)
  optimal = Math.round(optimal * rand(0.90, 1.10))

  // Hard collapse prevention: all personalities back off under critical stock
  if (fischbestand < 15) {
    optimal = Math.min(optimal, Math.max(0, Math.floor(boote * 0.2)))
  }

  return Math.max(0, Math.min(boote, optimal))
}
