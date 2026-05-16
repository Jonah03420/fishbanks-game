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

export function berechneFischbestand(aktuellerBestand, gesamteBoote) {
  const fangRate = 1.5                                    // reduziert von 2
  const gefangen = Math.min(gesamteBoote * fangRate, aktuellerBestand * 0.4)  // max 40% pro Runde
  const verbleibend = aktuellerBestand - gefangen

  const wachstum = GAME_CONFIG.wachstumsRate
    * verbleibend
    * (1 - verbleibend / GAME_CONFIG.maxFischbestand)

  return Math.max(0, Math.round(verbleibend + wachstum))
}

// Fang pro Team berechnen
export function berechneFang(ausgesandteBoote, fischbestand, gesamteBoote) {
  if (gesamteBoote === 0) return 0
  const anteil = ausgesandteBoote / gesamteBoote
  return Math.round(Math.min(gesamteBoote * 2, fischbestand) * anteil)
}

// Gewinn pro Team berechnen
export function berechneGewinn(fang, ausgesandteBoote) {
  const einnahmen = fang * GAME_CONFIG.fischPreis
  const kosten = ausgesandteBoote * 500 // Betriebskosten pro Boot
  return einnahmen - kosten
}