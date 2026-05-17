# 🐟 Fish Banks Game

Ein interaktives Planspiel zur **Tragedy of the Commons** (Tragödie der Allmende), entwickelt als Lernwerkzeug für universitäre Seminare zu nachhaltiger Ressourcenverwaltung und Systemdynamik.

---

## 🎯 Über das Spiel

Das Fish Banks Game simuliert ein klassisches Allmendedilemma: Vier Fischerteams teilen sich einen gemeinsamen Fischbestand. Jedes Team versucht, durch Fischfang möglichst viel Geld zu verdienen – doch wenn alle maximieren, kollabiert der Bestand.

Das Spiel demonstriert:

- **Tragedy of the Commons** (Garrett Hardin, 1968): Rationale Eigeninteressen zerstören gemeinsame Ressourcen.
- **Nash-Gleichgewicht vs. Kooperationsoptimum**: Individuell rationale Entscheidungen führen zu kollektiv suboptimalen Ergebnissen.
- **Feedback-Delay**: Überfischung ist erst sichtbar, wenn es oft zu spät ist.
- **Ostrom'sche Governance** (Elinor Ostrom, Nobelpreis 1990): Wie lokale Regeln Kollaps verhindern können.

---

## 🎮 Wie man spielt

### Spielstart
1. Gib deinen Teamnamen ein (optional, Standard: „Team A").
2. Wähle die Spiellänge: **10**, **15** oder **20 Runden**.
3. Klicke auf **„Spiel starten"**.

### Pro Runde hast du drei Entscheidungen:

| Entscheidung | Beschreibung | Kosten/Erlös |
|---|---|---|
| 🚢 Boot kaufen | Erhöht deine maximale Fangkapazität um 1 | 5.000€ |
| 💸 Boot verkaufen | Reduziert Kapazität, gibt Kapital frei | 3.000€ |
| 🐟 Boote aussenden | Wähle 0 bis max. Boote zum Fischen | – |

### Gegner-KI
Du spielst gegen drei KI-Teams mit unterschiedlichen Strategien:

- 🔴 **Team B – Gierig**: Fischt immer maximal, kauft aggressiv Boote.
- 🤝 **Team C – Kooperativ**: Fischt zurückhaltend, schützt den Bestand aktiv.
- 🧠 **Team D – Rational**: Berechnet den optimalen Einsatz anhand des Nash-Gleichgewichts.

### Spielende
Das Spiel endet nach der gewählten Rundenzahl **oder sofort**, wenn der Fischbestand auf 0% fällt (Kollaps). Im Abschlussbildschirm erhältst du:

- Rangliste aller Teams
- **Nachhaltigkeitsscore** (0–100)
- Vergleich mit dem theoretisch optimalen Ergebnis (50%-Strategie)
- **Schlüsselmomente** des Spielverlaufs
- Interaktiven Verlaufsgraph (Fischbestand + Teamguthaben)
- Wissenschaftliche Lernreflexion

---

## 📚 Lernziele

1. **Systemisches Denken**: Verständnis von Rückkopplungsschleifen und Verzögerungseffekten.
2. **Spieltheorie**: Erleben des Unterschieds zwischen Nash-Gleichgewicht und Kooperationsoptimum.
3. **Nachhaltigkeitsökonomie**: Abwägung zwischen kurzfristigem Gewinn und langfristiger Ressourcenerhaltung.
4. **Kollektive Entscheidungsfindung**: Wie individuelle Rationalität zu kollektivem Versagen führt.

---

## 🚀 Lokal ausführen

### Voraussetzungen
- [Node.js](https://nodejs.org/) (Version 18 oder höher)

### Installation

```bash
git clone <repository-url>
cd fishbanks-game
npm install
npm run dev
```

Öffne anschließend http://localhost:5173 im Browser.

### Produktions-Build

```bash
npm run build
npm run preview
```

---

## 🛠️ Tech Stack

| Technologie | Verwendung |
|---|---|
| React 19 | UI-Framework |
| Vite 8 | Build-Tool & Dev-Server |
| Tailwind CSS 4 | Styling & responsives Layout |
| Recharts 3 | Interaktive Diagramme |

---

## 📁 Projektstruktur

```
src/
├── components/FishGraph.jsx   # Inline-Verlaufsgraph während des Spiels
├── game/fishLogic.js          # Spielmechanik (Fischbestand, Fang, Gewinn)
├── game/gameState.js          # Initialer Spielzustand, Team-Definitionen
├── pages/StartPage.jsx        # Startbildschirm mit Konfiguration
├── pages/GamePage.jsx         # Hauptspielseite mit KI-Logik
├── pages/EndPage.jsx          # Debriefing & Auswertung
├── App.jsx                    # Routing zwischen den Seiten
└── index.css                  # Tailwind + CSS-Animationen
```

---

## 🔬 Wissenschaftlicher Hintergrund

Das Spiel basiert auf dem **Fish Banks Simulation Game** von Dennis Meadows (MIT, 1970er Jahre). Die digitale Implementierung vereinfacht das Original, bewahrt aber die zentralen Lernmechanismen: logistisches Fischbestandswachstum, gemeinsame Ressource ohne Eigentumsrechte, Informationsasymmetrie und Zeitverzögerung zwischen Ursache und Wirkung.

---

*Entwickelt im Rahmen einer Seminararbeit zum Thema Nachhaltigkeitsökonomie und Systemdynamik.*
