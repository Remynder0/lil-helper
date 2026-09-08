import React, { useState } from 'react';
import { HeroPicker } from './components/HeroPicker';
import { HeroAvatar } from './components/HeroAvatar';
import { getHeroById } from './data/heroes';
import { Side } from './types/match';
import { Shield, Sparkles, Swords } from 'lucide-react';

export const App: React.FC = () => {
  const [selectedHeroId, setSelectedHeroId] = useState<number | null>(null);
  const [side, setSide] = useState<Side>('hidden_king');
  const [pickedAllies] = useState<number[]>([]);

  const handleSelectHero = (heroId: number) => {
    if (selectedHeroId === heroId) {
      setSelectedHeroId(null);
    } else {
      setSelectedHeroId(heroId);
    }
  };

  const currentHero = selectedHeroId ? getHeroById(selectedHeroId) : null;

  return (
    <div className="min-h-screen bg-deadlock-dark text-gray-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-deadlock-border/80 bg-deadlock-panel/90 backdrop-blur px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-deadlock-hidden-king to-deadlock-archmother flex items-center justify-center text-black font-extrabold text-sm shadow-md">
            D
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide">Deadlock Draft & Match Analyzer</h1>
            <p className="text-xs text-deadlock-muted">Ranked Matchup & Synergy Tracker</p>
          </div>
        </div>

        {/* Side Selector preview */}
        <div className="flex items-center bg-deadlock-dark p-1 rounded-lg border border-deadlock-border text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSide('hidden_king')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              side === 'hidden_king'
                ? 'bg-deadlock-hidden-king text-black shadow-md shadow-deadlock-hidden-king/20'
                : 'text-deadlock-muted hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>The Hidden King</span>
          </button>
          <button
            type="button"
            onClick={() => setSide('archmother')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
              side === 'archmother'
                ? 'bg-deadlock-archmother text-black shadow-md shadow-deadlock-archmother/20'
                : 'text-deadlock-muted hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>The Archmother</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col gap-6">
        {/* Active Selection Banner */}
        <div className="bg-deadlock-panel border border-deadlock-border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <HeroAvatar
              heroId={selectedHeroId}
              size="lg"
              showName={false}
              accentColor={side}
              isHighlighted={!!selectedHeroId}
              onRemove={selectedHeroId ? () => setSelectedHeroId(null) : undefined}
            />
            <div>
              <span className="text-xs uppercase font-mono tracking-wider text-deadlock-muted">
                Selected Hero (Test Preview)
              </span>
              <h2 className="text-lg font-bold text-white">
                {currentHero ? currentHero.name : 'Click a hero in the grid below'}
              </h2>
              {currentHero && (
                <p className="text-xs text-deadlock-muted mt-0.5">
                  <span className="capitalize font-semibold text-gray-300">{currentHero.heroType}</span> • {currentHero.role}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-deadlock-muted">
            <Swords className="w-4 h-4 text-deadlock-muted" />
            <span>Ready for 6v6 Match Logging Form (Issue #5)</span>
          </div>
        </div>

        {/* Hero Picker Component */}
        <HeroPicker
          title="Hero Roster"
          subtitle="Click to select or toggle. Use the search bar or role tabs to filter."
          selectedHeroIds={selectedHeroId ? [selectedHeroId] : []}
          disabledHeroIds={pickedAllies}
          onSelectHero={handleSelectHero}
          accentColor={side}
        />
      </main>
    </div>
  );
};

export default App;
