import { GAME_CONFIG } from '../game/fishLogic'

function StartPage({ onCreateGame, onJoinGame }) {
  return (
    <div className="w-full h-full bg-blue-900 text-white flex overflow-hidden">

      {/* Left panel — branding + feature highlights */}
      <div className="flex-1 flex flex-col justify-center px-16 py-12 bg-gradient-to-br from-blue-800 to-blue-950">
        <div className="text-9xl mb-6 float-fish inline-block">🐟</div>
        <h1 className="text-6xl font-bold mb-4 leading-tight">Fish Banks<br />Game</h1>
        <p className="text-blue-200 text-xl mb-10 max-w-md">
          Kannst du die Fischbestände nachhaltig bewirtschaften – während andere Teams rücksichtslos fischen?
        </p>

        <div className="grid grid-cols-2 gap-4 max-w-lg">
          <div className="bg-white/10 rounded-2xl p-4">
            <div className="text-2xl mb-2">🌊</div>
            <div className="font-bold text-sm mb-1">Gemeinsame Ressource</div>
            <div className="text-blue-300 text-xs">Alle Teams teilen denselben Fischbestand – Übernutzung zerstört ihn für alle.</div>
          </div>
          <div className="bg-white/10 rounded-2xl p-4">
            <div className="text-2xl mb-2">🤖</div>
            <div className="font-bold text-sm mb-1">KI füllt freie Slots</div>
            <div className="text-blue-300 text-xs">Gierig, kooperativ oder rational – KI-Teams füllen automatisch leere Plätze auf.</div>
          </div>
          <div className="bg-white/10 rounded-2xl p-4">
            <div className="text-2xl mb-2">📈</div>
            <div className="font-bold text-sm mb-1">Echtzeit-Analyse</div>
            <div className="text-blue-300 text-xs">Verfolge Fischbestand und Guthaben aller Teams über den gesamten Spielverlauf.</div>
          </div>
          <div className="bg-white/10 rounded-2xl p-4">
            <div className="text-2xl mb-2">🎓</div>
            <div className="font-bold text-sm mb-1">Lernspiel</div>
            <div className="text-blue-300 text-xs">Basierend auf Garrett Hardins „Tragedy of the Commons" und Elinor Ostroms Forschung.</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 max-w-lg mt-2 text-xs text-blue-300">
          <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
            <div className="font-bold text-white">🚢 {GAME_CONFIG.initialBoote} Boote</div>
            <div>Startflotte (konfig.)</div>
          </div>
          <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
            <div className="font-bold text-white">💰 {GAME_CONFIG.startGuthaben.toLocaleString()}€</div>
            <div>Startkapital (konfig.)</div>
          </div>
          <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
            <div className="font-bold text-white">🐟 {GAME_CONFIG.startFischbestand.toLocaleString()} / {GAME_CONFIG.maxFischbestand.toLocaleString()}</div>
            <div>Fischbestand (Start / Max)</div>
          </div>
          <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
            <div className="font-bold text-white">💵 {GAME_CONFIG.fischPreis}€ / Fisch</div>
            <div>Fischpreis</div>
          </div>
          <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
            <div className="font-bold text-white">🛒 {GAME_CONFIG.bootKosten}€ neu</div>
            <div>Boot kaufen (Werft)</div>
          </div>
          <div className="bg-white/5 rounded-xl px-3 py-2 text-center">
            <div className="font-bold text-white">🔄 {GAME_CONFIG.auctionPreis}€ Auktion</div>
            <div>Boot kaufen / verkaufen</div>
          </div>
        </div>
      </div>

      {/* Right panel — action */}
      <div className="w-96 flex flex-col justify-center px-10 py-12 bg-blue-950/60 border-l border-white/10">
        <h2 className="text-2xl font-bold mb-2">Spiel starten</h2>
        <p className="text-blue-300 text-sm mb-10">Erstelle einen Raum als Host oder tritt einem laufenden Spiel bei.</p>

        <div className="flex flex-col gap-4">
          <button
            onClick={onCreateGame}
            className="w-full bg-green-500 hover:bg-green-400 text-white font-bold py-5 px-6 rounded-2xl text-lg transition-colors text-left flex items-center gap-4"
          >
            <span className="text-3xl">🎮</span>
            <div>
              <div className="font-bold">Spiel erstellen</div>
              <div className="text-green-100 text-sm font-normal">Als Host einen Raum eröffnen</div>
            </div>
          </button>

          <button
            onClick={onJoinGame}
            className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-5 px-6 rounded-2xl text-lg transition-colors text-left flex items-center gap-4"
          >
            <span className="text-3xl">🔗</span>
            <div>
              <div className="font-bold">Spiel beitreten</div>
              <div className="text-blue-100 text-sm font-normal">Mit 4-stelligem Raum-Code eintreten</div>
            </div>
          </button>
        </div>

        <div className="mt-12 bg-white/5 rounded-2xl p-5 text-xs text-blue-400">
          <div className="font-bold text-blue-300 mb-2">So funktioniert es</div>
          <ol className="space-y-1.5 list-decimal list-inside">
            <li>Host erstellt Raum &amp; teilt den Code mit Teilnehmern</li>
            <li>Spieler treten bei – leere Slots werden von KI gefüllt</li>
            <li>Entscheide jede Runde: Wie viele Boote sendest du aus?</li>
            <li>Bewirtschafte nachhaltig – oder riskiere den Kollaps!</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default StartPage
