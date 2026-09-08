import React, { useState } from 'react';
import { HeroAvatar } from './HeroAvatar';
import { HeroPicker } from './HeroPicker';
import { Match, MatchDraftInput, Side, MatchResult, validateMatchInput } from '../types/match';
import { persistMatch } from '../services/storage';
import { Shield, Sparkles, Trophy, Skull, CheckCircle, AlertCircle, RotateCcw, Save } from 'lucide-react';

interface MatchFormProps {
  onMatchSaved?: (savedMatch: Match) => void;
  onCancel?: () => void;
  className?: string;
}

type ActiveDraftSection = 'my_hero' | 'allies' | 'enemies';

export const MatchForm: React.FC<MatchFormProps> = ({
  onMatchSaved,
  onCancel,
  className = '',
}) => {
  // Form State
  const [side, setSide] = useState<Side>('hidden_king');
  const [myHeroId, setMyHeroId] = useState<number | null>(null);
  const [allies, setAllies] = useState<number[]>([]);
  const [enemies, setEnemies] = useState<number[]>([]);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [notes, setNotes] = useState<string>('');

  // Active slot targeting
  const [activeSection, setActiveSection] = useState<ActiveDraftSection>('my_hero');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // All currently picked hero IDs (cannot be picked twice)
  const allPickedHeroIds: number[] = [
    ...(myHeroId ? [myHeroId] : []),
    ...allies,
    ...enemies,
  ];

  // Opposing side for enemy team styling
  const enemySide: Side = side === 'hidden_king' ? 'archmother' : 'hidden_king';

  // Handle hero click in the picker
  const handleHeroClick = (heroId: number) => {
    // If hero is already picked, remove it from wherever it is
    if (myHeroId === heroId) {
      setMyHeroId(null);
      setActiveSection('my_hero');
      return;
    }
    if (allies.includes(heroId)) {
      setAllies(allies.filter((id) => id !== heroId));
      setActiveSection('allies');
      return;
    }
    if (enemies.includes(heroId)) {
      setEnemies(enemies.filter((id) => id !== heroId));
      setActiveSection('enemies');
      return;
    }

    // Otherwise, assign to active section
    if (activeSection === 'my_hero') {
      setMyHeroId(heroId);
      // Auto-advance to allies if allies are not full yet
      if (allies.length < 5) {
        setActiveSection('allies');
      } else if (enemies.length < 6) {
        setActiveSection('enemies');
      }
    } else if (activeSection === 'allies') {
      if (allies.length < 5) {
        const nextAllies = [...allies, heroId];
        setAllies(nextAllies);
        if (nextAllies.length === 5 && enemies.length < 6) {
          // Auto-advance to enemies when allies are complete
          setActiveSection('enemies');
        }
      }
    } else if (activeSection === 'enemies') {
      if (enemies.length < 6) {
        setEnemies([...enemies, heroId]);
      }
    }
  };

  // Reset entire form
  const handleReset = () => {
    setMyHeroId(null);
    setAllies([]);
    setEnemies([]);
    setResult(null);
    setNotes('');
    setActiveSection('my_hero');
    setValidationErrors([]);
    setSuccessMessage(null);
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);
    setSuccessMessage(null);

    const input: MatchDraftInput = {
      side,
      myHeroId,
      allies,
      enemies,
      result,
      notes: notes.trim() ? notes.trim() : undefined,
    };

    const errors = validateMatchInput(input);
    if (errors.length > 0) {
      setValidationErrors(errors.map((err) => err.message));
      return;
    }

    setIsSubmitting(true);
    try {
      const matchToSave: Match = {
        id: crypto.randomUUID ? crypto.randomUUID() : `match_${Date.now()}`,
        date: new Date().toISOString(),
        side,
        myHeroId: myHeroId!,
        allies,
        enemies,
        result: result!,
        notes: notes.trim() || undefined,
      };

      const saved = await persistMatch(matchToSave);
      setSuccessMessage('Match successfully recorded!');
      if (onMatchSaved) {
        onMatchSaved(saved);
      }
      handleReset();
    } catch (err) {
      console.error('Failed to save match:', err);
      setValidationErrors(['An unexpected error occurred while saving the match.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPicked = allPickedHeroIds.length;

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-5 ${className}`}>
      {/* Top Banner: Faction Selector & Outcome Selection */}
      <div className="bg-deadlock-panel border border-deadlock-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Faction Choice */}
        <div className="flex flex-col items-start gap-1.5 w-full md:w-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-deadlock-muted">
            1. Your Patron Faction
          </span>
          <div className="flex items-center gap-2 bg-deadlock-dark p-1 rounded-lg border border-deadlock-border w-full md:w-auto">
            <button
              type="button"
              onClick={() => setSide('hidden_king')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all ${
                side === 'hidden_king'
                  ? 'bg-deadlock-hidden-king text-black shadow-md shadow-deadlock-hidden-king/25 ring-1 ring-deadlock-hidden-king-light'
                  : 'text-deadlock-muted hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>The Hidden King</span>
            </button>
            <button
              type="button"
              onClick={() => setSide('archmother')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all ${
                side === 'archmother'
                  ? 'bg-deadlock-archmother text-black shadow-md shadow-deadlock-archmother/25 ring-1 ring-deadlock-archmother-light'
                  : 'text-deadlock-muted hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>The Archmother</span>
            </button>
          </div>
        </div>

        {/* Outcome Choice (Victory / Defeat) */}
        <div className="flex flex-col items-start md:items-end gap-1.5 w-full md:w-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-deadlock-muted">
            2. Match Result
          </span>
          <div className="flex items-center gap-2 bg-deadlock-dark p-1 rounded-lg border border-deadlock-border w-full md:w-auto">
            <button
              type="button"
              onClick={() => setResult('win')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${
                result === 'win'
                  ? 'bg-deadlock-win text-black shadow-md shadow-deadlock-win/30 ring-1 ring-green-300'
                  : 'text-deadlock-muted hover:text-green-400'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>VICTORY</span>
            </button>
            <button
              type="button"
              onClick={() => setResult('loss')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${
                result === 'loss'
                  ? 'bg-deadlock-loss text-white shadow-md shadow-deadlock-loss/30 ring-1 ring-red-400'
                  : 'text-deadlock-muted hover:text-red-400'
              }`}
            >
              <Skull className="w-4 h-4" />
              <span>DEFEAT</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6v6 Draft Board */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Your Team (My Hero + 5 Allies) */}
        <div
          className={`bg-deadlock-panel border rounded-xl p-4 flex flex-col gap-3 transition-colors ${
            activeSection === 'my_hero' || activeSection === 'allies'
              ? 'border-deadlock-border ring-1 ring-white/20'
              : 'border-deadlock-border/70'
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-deadlock-border/60">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  side === 'hidden_king' ? 'bg-deadlock-hidden-king' : 'bg-deadlock-archmother'
                }`}
              />
              <h3 className="text-sm font-bold text-gray-100">
                YOUR TEAM ({side === 'hidden_king' ? 'The Hidden King' : 'The Archmother'})
              </h3>
            </div>
            <span className="text-xs font-mono text-deadlock-muted">
              {myHeroId ? 1 + allies.length : allies.length}/6 heroes
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 py-1">
            {/* My Hero Slot */}
            <div
              onClick={() => setActiveSection('my_hero')}
              className={`cursor-pointer rounded-xl p-2 flex flex-col items-center gap-1 border-2 transition-all ${
                activeSection === 'my_hero'
                  ? 'border-white bg-white/5 ring-2 ring-white/20'
                  : 'border-deadlock-border/80 hover:border-gray-400'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-deadlock-hidden-king">
                ★ You
              </span>
              <HeroAvatar
                heroId={myHeroId}
                size="md"
                accentColor={side}
                isHighlighted={activeSection === 'my_hero'}
                onRemove={myHeroId ? () => setMyHeroId(null) : undefined}
              />
            </div>

            <div className="h-10 w-px bg-deadlock-border/60 mx-1 hidden sm:block" />

            {/* 5 Allied Slots */}
            <div
              onClick={() => setActiveSection('allies')}
              className={`flex-1 cursor-pointer rounded-xl p-2 flex flex-col gap-1 border-2 transition-all ${
                activeSection === 'allies'
                  ? 'border-white bg-white/5 ring-2 ring-white/20'
                  : 'border-deadlock-border/80 hover:border-gray-400'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-deadlock-muted">
                Allies ({allies.length}/5)
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {[0, 1, 2, 3, 4].map((slotIndex) => {
                  const heroId = allies[slotIndex] || null;
                  return (
                    <HeroAvatar
                      key={slotIndex}
                      heroId={heroId}
                      size="sm"
                      accentColor={side}
                      onRemove={
                        heroId ? () => setAllies(allies.filter((id) => id !== heroId)) : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Enemy Team (6 Enemies) */}
        <div
          onClick={() => setActiveSection('enemies')}
          className={`cursor-pointer bg-deadlock-panel border rounded-xl p-4 flex flex-col gap-3 transition-colors ${
            activeSection === 'enemies'
              ? 'border-white bg-white/5 ring-1 ring-white/20'
              : 'border-deadlock-border/70 hover:border-gray-400'
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-deadlock-border/60">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  enemySide === 'hidden_king' ? 'bg-deadlock-hidden-king' : 'bg-deadlock-archmother'
                }`}
              />
              <h3 className="text-sm font-bold text-gray-100">
                ENEMY TEAM ({enemySide === 'hidden_king' ? 'The Hidden King' : 'The Archmother'})
              </h3>
            </div>
            <span className="text-xs font-mono text-deadlock-muted">{enemies.length}/6 heroes</span>
          </div>

          <div className="flex items-center gap-2.5 py-2 flex-wrap">
            {[0, 1, 2, 3, 4, 5].map((slotIndex) => {
              const heroId = enemies[slotIndex] || null;
              return (
                <HeroAvatar
                  key={slotIndex}
                  heroId={heroId}
                  size="sm"
                  accentColor={enemySide}
                  onRemove={
                    heroId ? () => setEnemies(enemies.filter((id) => id !== heroId)) : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Hero Picker Grid */}
      <HeroPicker
        title={
          activeSection === 'my_hero'
            ? 'Select Your Played Hero'
            : activeSection === 'allies'
            ? `Select Teammates (${allies.length}/5)`
            : `Select Opponents (${enemies.length}/6)`
        }
        subtitle="Click a hero to add or remove from current section. Switch sections above at any time."
        selectedHeroIds={
          activeSection === 'my_hero'
            ? myHeroId
              ? [myHeroId]
              : []
            : activeSection === 'allies'
            ? allies
            : enemies
        }
        disabledHeroIds={allPickedHeroIds}
        onSelectHero={handleHeroClick}
        accentColor={activeSection === 'enemies' ? enemySide : side}
      />

      {/* Notes & Actions */}
      <div className="bg-deadlock-panel border border-deadlock-border rounded-xl p-4 flex flex-col gap-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-deadlock-muted">
          Match Notes (Optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Tough lane matchup against Vindicta, won team fights in mid-game..."
          rows={2}
          className="w-full bg-deadlock-dark border border-deadlock-border rounded-lg p-3 text-xs text-gray-200 placeholder-deadlock-muted/60 focus:outline-none focus:border-deadlock-muted resize-none transition-colors"
        />

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-red-950/40 border border-red-800/80 rounded-lg p-3 flex items-start gap-2.5 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-bold">Please resolve the following:</span>
              <ul className="list-disc list-inside space-y-0.5">
                {validationErrors.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="bg-green-950/40 border border-green-800/80 rounded-lg p-3 flex items-center gap-2 text-xs text-green-200">
            <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-deadlock-border/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-deadlock-muted hover:text-white hover:bg-deadlock-border/40 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Draft</span>
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-2 rounded-lg text-xs font-medium text-deadlock-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-deadlock-muted">
              {totalPicked}/12 heroes picked
            </span>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-white text-black hover:bg-gray-200 shadow-lg shadow-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'Save Match'}</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
