# Fish Banks – Digitaler Prototyp

Dies ist der Code-Anhang zur Seminararbeit **„Theoretische Analyse und
webbasierte Implementierung eines digitalen Prototyps für das Educational
Simulation Game ‚Fish Banks'"** von **Denis Ercan** und **Jonah Schulze**,
Lehrstuhl für Wirtschaftsinformatik und Business Analytics, Julius-Maximilians-
Universität Würzburg.

Die Anwendung ist ein webbasierter, echtzeitfähiger Mehrspieler-Prototyp des
Planspiels *Fish Banks* (Meadows, MIT): Mehrere Teams (Menschen und/oder KI)
teilen sich einen gemeinsamen Fischbestand, entscheiden rundenweise über den
Einsatz ihrer Flotte auf drei Fanggebiete und handeln Schiffe über einen
Echtzeit-Auktionsmarkt.

---

## 1. Voraussetzungen

- **Node.js**: `^20.19.0` oder `>=22.12.0` (Anforderung von Vite 8). Getestet
  mit **Node v24.14.0**.
- **npm**: getestet mit **npm 11.9.0** (im Lieferumfang von Node enthalten).

Version prüfen:

```bash
node --version
npm --version
```

---

## 2. Installation & Start

### 2.1 Installation

```bash
git clone <repository-url>
cd fishbanks-game
npm install
```

### 2.2 Entwicklungsmodus (empfohlen für die Abnahme)

Die Anwendung besteht aus zwei Prozessen — dem Express/Socket.io-Backend und
dem Vite-Dev-Server für das React-Frontend. Beide müssen laufen.

**Variante A — ein Befehl, beide Prozesse parallel:**

```bash
npm run dev:all
```

**Variante B — zwei Terminals (leichter zu beobachten/debuggen):**

```bash
# Terminal 1 — Backend
npm run server

# Terminal 2 — Frontend
npm run dev
```

Danach im Browser öffnen:

```
http://localhost:5173
```

Das Backend läuft dabei auf `http://localhost:3002` (Socket.io-Verbindung
erfolgt automatisch; siehe `src/hooks/useSocket.js`). Beide Ports sind
Standardwerte ohne weitere Konfiguration.

### 2.3 Produktions-Build

```bash
npm run build          # erzeugt dist/ (statisches Frontend)
NODE_ENV=production node server.js
```

Im Produktionsmodus liefert der Node-Server selbst die gebauten
Frontend-Dateien aus `dist/` aus (siehe `server.js`, Abschnitt „Static
Frontend") — es ist dann nur noch **ein** Prozess und **ein** Port nötig.
Standardport ist `3002`, überschreibbar per Umgebungsvariable `PORT` (das
Deployment auf Render, siehe `render.yaml`, setzt z. B. `PORT=10000`).

### 2.4 Umgebungsvariablen (optional)

`.env.example` zeigt die unterstützten Variablen:

```
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

Für den lokalen Dev-Betrieb sind **keine** `.env`-Variablen nötig — die
Defaults in `server.js` (`PORT=3002`) und `src/hooks/useSocket.js`
(`http://localhost:3002`) reichen aus. `PORT` und `CORS_ORIGIN` sind nur für
abweichende Deployment-Umgebungen relevant.

---

## 3. Projektstruktur

```
fishbanks-game/
├── server.js                      # Express + Socket.io Backend (autoritative Spiellogik,
│                                   #   Raum-/Lobby-Verwaltung, Rundenverarbeitung, Auktionsmarkt)
├── src/
│   ├── main.jsx                   # React-Einstiegspunkt
│   ├── App.jsx                    # Seiten-Routing (Start → Lobby → Spiel → Ende)
│   ├── hooks/
│   │   └── useSocket.js           # Socket.io-Client-Verbindung
│   ├── game/                      # Von Client UND Server gemeinsam genutzte Spiellogik
│   │   ├── fishLogic.js           #   Spielparameter (GAME_CONFIG), Fischbestandsmodell,
│   │   │                          #   Fangberechnung, KI-Entscheidungslogik (easy/hard)
│   │   ├── adminSettings.js       #   Instructor-Einstellungen (siehe Abschnitt 6, Einschränkungen)
│   │   └── teamColors.js          #   Team-Farbzuordnung
│   ├── pages/
│   │   ├── StartPage.jsx          # Startbildschirm
│   │   ├── LobbyPage.jsx          # Raum erstellen/beitreten, Warteraum, Host-Einstellungen
│   │   ├── GamePage.jsx           # Hauptspielseite: Dashboard, Reports, Market (Auktionsmarkt)
│   │   ├── EndPage.jsx            # Auswertungsdashboard nach Spielende
│   │   └── AdminPage.jsx          # Instructor Settings (siehe Abschnitt 6, Einschränkungen)
│   └── components/
│       ├── FishGraph.jsx          # Verlaufsgraph Fischbestand
│       └── icons.jsx              # UI-Icons
├── index.html                     # Vite-Einstiegspunkt
├── vite.config.js                 # Vite-Konfiguration (React + Tailwind Plugin)
├── render.yaml                    # Deployment-Konfiguration (Render.com)
└── package.json
```

---

## 4. Spielablauf – Kurzanleitung

1. **Raum erstellen (Host):** Auf der Startseite „Create Game" wählen, Namen
   eingeben, „Create Room" klicken.
2. Der Host erhält einen **vierstelligen Raumcode** (z. B. `ABCD`), den er an
   die übrigen Teams weitergibt.
3. **Beitreten:** Weitere Spieler:innen wählen „Join Game", geben ihren Namen
   und den Raumcode ein.
4. Im Warteraum kann der Host **Rundenzahl** (10/15/20), **KI-Schwierigkeit**
   (Easy/Hard), Startkapital und Startflotte einstellen.
5. **Freie Plätze** (bis zur eingestellten Teamzahl) werden automatisch von
   **KI-Teams** aufgefüllt — es muss nicht auf weitere menschliche
   Mitspieler:innen gewartet werden.
6. Der Host startet die Partie über „Start Game". Danach entscheidet jedes
   menschliche Team pro Runde über Flottenverteilung (Hafen/Küste/Tiefsee),
   Schiffskäufe/-verkäufe und Neubestellungen und reicht seine Entscheidung
   ein; sobald alle menschlichen Teams eingereicht haben, verarbeitet der
   Server die Runde.

---

## 5. Reproduktion der Abbildungen aus der Arbeit

### Abbildung 1 — Echtzeit-Auktionsmarkt

1. Eine laufende Partie starten (siehe Abschnitt 4; ein Raum mit mindestens
   einem menschlichen Team reicht, freie Plätze übernimmt die KI).
2. In der Spielansicht oben den Tab **„Market"** öffnen.
3. Im Bereich **„Ship Auction"** unter „List Ships for Sale" eine Stückzahl
   und einen Mindestpreis eingeben und auf **„List for Auction"** klicken —
   das eigene Schiff erscheint sofort als Live-Angebot.
4. Sobald ein (menschliches oder KI-)Team ein Gebot abgibt, startet ein
   20-Sekunden-Timer; weitere Teams können in Echtzeit nachbieten oder
   passen. KI-Teams reagieren mit einer kurzen, zufälligen Verzögerung
   (ca. 1,8–5 s), um menschliches Bietverhalten zu simulieren.
5. Für den Screenshot/die Abbildung genügt es, mit zwei Browser-Fenstern
   (oder einem zweiten Gerät) demselben Raum als zwei unterschiedliche Teams
   beizutreten und gegeneinander zu bieten — so sind beide Seiten des
   Live-Marktes sichtbar.

### Abbildung 2 — Auswertungsdashboard

1. Eine Partie mit **kurzer Rundenzahl** (10 Runden reicht) starten, um sie
   zügig durchzuspielen.
2. Jede Runde die eigenen Entscheidungen einreichen (KI-Teams entscheiden
   automatisch) und mit „Weiter"/„Next Round" bestätigen, bis entweder die
   maximale Rundenzahl erreicht ist **oder** der Fischbestand auf 0 fällt.
3. Nach Spielende wechselt die Anwendung automatisch zum
   **Auswertungsdashboard** (`EndPage.jsx`) mit Rangliste nach Net Worth,
   Nachhaltigkeitsscore, Vergleich zum theoretischen Optimalergebnis,
   „Key Moments" des Spielverlaufs und dem Verlaufsgraph des Fischbestands.

---

## 6. Bekannte Einschränkungen

- **Kein persistenter Spielzustand:** Räume, Lobbys und laufende Partien
  werden ausschließlich im Arbeitsspeicher des Node-Prozesses gehalten
  (`server.js`, `Map` in `rooms`). Ein Server-Neustart löscht alle aktiven
  Partien; es gibt keine Datenbank-Anbindung. Inaktive Räume werden
  serverseitig nach 10–60 Minuten automatisch aufgeräumt.
- **Zwei konzipierte, aber nicht an die UI angebundene Funktionen**
  (vgl. Abschnitt 4.4 der Arbeit, Ausblick):
  - **Informationsasymmetrie-Schalter** (`showFishStock`,
    `showOtherCatches` in `src/game/adminSettings.js` /
    `src/pages/AdminPage.jsx`): Die Logik zum Verbergen des Fischbestands
    bzw. der Ergebnisse anderer Teams ist in `GamePage.jsx` bereits
    implementiert und auswertbar, wird aber beim Erstellen eines Raums
    (`LobbyPage.jsx`) nicht an den Server übergeben und ist daher über die
    Oberfläche nicht erreichbar.
  - **Erweiterte Instructor-Konfiguration** (`AdminPage.jsx`): Speichert
    Einstellungen aktuell nur lokal im Browser (`localStorage`) und ist
    nicht mit der tatsächlichen Raumerstellung verknüpft.

---

## 7. Verwendete Bibliotheken

| Bibliothek | Version | Verwendung |
|---|---|---|
| React | 19.2.6 | UI-Framework |
| React DOM | 19.2.6 | React-Rendering |
| Vite | 8.0.13 | Build-Tool & Dev-Server |
| @vitejs/plugin-react | 6.0.2 | React-Support für Vite |
| Tailwind CSS | 4.3.0 | Styling |
| @tailwindcss/vite | 4.3.0 | Tailwind-Vite-Integration |
| Recharts | 3.8.1 | Interaktive Diagramme (Verlaufsgraph, Dashboard) |
| Express | 5.2.1 | HTTP-Server (Backend) |
| Socket.io | 4.8.3 | Echtzeit-Kommunikation (Server) |
| Socket.io-client | 4.8.3 | Echtzeit-Kommunikation (Client) |
| cors | 2.8.6 | CORS-Konfiguration für das Backend |
| ESLint | 10.4.0 | Linting (Entwicklung) |
| concurrently | 9.2.1 | Parallelstart von Client & Server (Entwicklung) |
| nodemon | 3.1.14 | Automatischer Server-Neustart (Entwicklung) |

Vollständige Versionsangaben inkl. transitiver Abhängigkeiten:
`package-lock.json`.
