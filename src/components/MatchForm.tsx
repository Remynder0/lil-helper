import React, { useState } from 'react';
import { HeroAvatar } from './HeroAvatar';
import { HeroPicker } from './HeroPicker';
import { getHeroById } from '../data/heroes';
import {
  Match,
  MatchDraftInput,
  Side,
  MatchResult,
  LaneColor,
  LaneOutcome,
  LANE_OUTCOME_LABELS,
  validateMatchInput,
} from '../types/match';
import { persistMatch } from '../services/storage';
import { Shield, Sparkles, Trophy, Skull, Ban, CheckCircle, AlertCircle, RotateCcw, Save, Compass, Swords, Users } from 'lucide-react';

interface MatchFormProps {
  editingMatch?: Match | null;
  onMatchSaved?: (savedMatch: Match) => void;
  onCancel?: () => void;
  className?: string;
}

type ActiveDraftSection = 'my_hero' | 'allies' | 'enemies';

export const MatchForm: React.FC<MatchFormProps> = ({
  editingMatch,
  onMatchSaved,
  onCancel,
  className = '',
}) => {
  // Form State initialized from editingMatch if provided
  const [side, setSide] = useState<Side>(editingMatch ? editingMatch.side : 'hidden_king');
  const [myHeroId, setMyHeroId] = useState<number | null>(editingMatch ? editingMatch.myHeroId : null);
  const [allies, setAllies] = useState<number[]>(editingMatch ? editingMatch.allies : []);
  const [enemies, setEnemies] = useState<number[]>(editingMatch ? editingMatch.enemies : []);
  const [result, setResult] = useState<MatchResult | null>(editingMatch ? editingMatch.result : null);
  const [notes, setNotes] = useState<string>(editingMatch?.notes || '');

  // Lane Matchup Tracking (3 lanes: Yellow, Blue, Green)
  const [lane, setLane] = useState<LaneColor | null>(editingMatch?.lane || null);
  const [laneAllyId, setLaneAllyId] = useState<number | null>(editingMatch?.laneAllyId || null);
  const [laneOpponents, setLaneOpponents] = useState<number[]>(editingMatch?.laneOpponents || []);
  const [laneOutcome, setLaneOutcome] = useState<LaneOutcome | null>(editingMatch?.laneOutcome || null);

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
    setLane(null);
    setLaneAllyId(null);
    setLaneOpponents([]);
    setLaneOutcome(null);
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
      lane: lane || undefined,
      laneAllyId: laneAllyId || undefined,
      laneOpponents: laneOpponents.length > 0 ? laneOpponents : undefined,
      laneOutcome: laneOutcome || undefined,
    };

    const errors = validateMatchInput(input);
    if (errors.length > 0) {
      setValidationErrors(errors.map((err) => err.message));
      return;
    }

    setIsSubmitting(true);
    try {
      const matchToSave: Match = {
        id: editingMatch ? editingMatch.id : (crypto.randomUUID ? crypto.randomUUID() : `match_${Date.now()}`),
        date: editingMatch ? editingMatch.date : new Date().toISOString(),
        side,
        myHeroId: myHeroId!,
        allies,
        enemies,
        result: result!,
        notes: notes.trim() || undefined,
        lane: lane || undefined,
        laneAllyId: laneAllyId || undefined,
        laneOpponents: laneOpponents.length > 0 ? laneOpponents : undefined,
        laneOutcome: laneOutcome || undefined,
      };

      const saved = await persistMatch(matchToSave);
      setSuccessMessage(editingMatch ? 'Match successfully updated!' : 'Match successfully recorded!');
      if (onMatchSaved) {
        onMatchSaved(saved);
      }
      if (!editingMatch) {
        handleReset();
      }
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
      {/* Editing Mode Banner */}
      {editingMatch && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Editing recorded match from{' '}
              <strong>
                {new Date(editingMatch.date).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </strong>
            </span>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium transition-colors"
            >
              Cancel Edit
            </button>
          )}
        </div>
      )}

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
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all ${
                result === 'loss'
                  ? 'bg-deadlock-loss text-white shadow-md shadow-deadlock-loss/30 ring-1 ring-red-400'
                  : 'text-deadlock-muted hover:text-red-400'
              }`}
            >
              <Skull className="w-4 h-4" />
              <span>DEFEAT</span>
            </button>
            <button
              type="button"
              onClick={() => setResult('cancel')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all ${
                result === 'cancel'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-md shadow-amber-500/20 ring-1 ring-amber-400'
                  : 'text-deadlock-muted hover:text-amber-300'
              }`}
            >
              <Ban className="w-4 h-4" />
              <span>CANCELLED</span>
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

      {/* Lane Assignment & Matchup */}
      <div className="bg-deadlock-panel border border-deadlock-border rounded-xl p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2 border-b border-deadlock-border/60">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-deadlock-accent" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">
              Lane Assignment & Matchup (Optional)
            </h3>
          </div>
          {lane && (
            <button
              type="button"
              onClick={() => {
                setLane(null);
                setLaneAllyId(null);
                setLaneOpponents([]);
                setLaneOutcome(null);
              }}
              className="text-[11px] text-deadlock-muted hover:text-white transition-colors"
            >
              Clear Lane Data
            </button>
          )}
        </div>

        {/* 1. Lane Selection (Yellow, Blue, Green) */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-deadlock-muted">
            Which lane did you play on?
          </span>
          <div className="grid grid-cols-3 gap-3">
            {/* Yellow Lane */}
            <button
              type="button"
              onClick={() => setLane(lane === 'yellow' ? null : 'yellow')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                lane === 'yellow'
                  ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300 shadow-md shadow-yellow-500/10'
                  : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:border-yellow-400/50 hover:text-yellow-200'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm shadow-yellow-400" />
              <span>Yellow Lane</span>
            </button>

            {/* Blue Lane */}
            <button
              type="button"
              onClick={() => setLane(lane === 'blue' ? null : 'blue')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                lane === 'blue'
                  ? 'bg-blue-500/20 border-blue-400 text-blue-300 shadow-md shadow-blue-500/10'
                  : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:border-blue-400/50 hover:text-blue-200'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-blue-400 shadow-sm shadow-blue-400" />
              <span>Blue Lane</span>
            </button>

            {/* Green Lane */}
            <button
              type="button"
              onClick={() => setLane(lane === 'green' ? null : 'green')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                lane === 'green'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-500/10'
                  : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:border-emerald-400/50 hover:text-emerald-200'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
              <span>Green Lane</span>
            </button>
          </div>
        </div>

        {/* 2. Lane Partner & Direct Opponents (visible if lane is selected) */}
        {lane && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-deadlock-border/40">
            {/* Lane Ally Partner */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-deadlock-muted flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-deadlock-archmother" />
                <span>Your Lane Partner:</span>
              </span>
              {allies.length === 0 ? (
                <p className="text-[11px] text-deadlock-muted italic">
                  Select your allied team above to assign your lane partner.
                </p>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {allies.map((allyId) => {
                    const isSelected = laneAllyId === allyId;
                    return (
                      <button
                        key={allyId}
                        type="button"
                        onClick={() => setLaneAllyId(isSelected ? null : allyId)}
                        className={`flex items-center gap-1.5 p-1.5 pr-2.5 rounded-lg border text-xs transition-all ${
                          isSelected
                            ? 'bg-deadlock-archmother/20 border-deadlock-archmother text-white ring-1 ring-deadlock-archmother/50'
                            : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-white'
                        }`}
                      >
                        <HeroAvatar heroId={allyId} size="xs" />
                        <span className="font-semibold text-[11px]">{getHeroById(allyId)?.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Lane Direct Opponents (Up to 2 enemies) */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-deadlock-muted flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-deadlock-hidden-king" />
                <span>Direct Lane Opponents ({laneOpponents.length}/2):</span>
              </span>
              {enemies.length === 0 ? (
                <p className="text-[11px] text-deadlock-muted italic">
                  Select enemy team heroes above to assign your lane opponents.
                </p>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {enemies.map((enemyId) => {
                    const isSelected = laneOpponents.includes(enemyId);
                    return (
                      <button
                        key={enemyId}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setLaneOpponents(laneOpponents.filter((id) => id !== enemyId));
                          } else if (laneOpponents.length < 2) {
                            setLaneOpponents([...laneOpponents, enemyId]);
                          }
                        }}
                        className={`flex items-center gap-1.5 p-1.5 pr-2.5 rounded-lg border text-xs transition-all ${
                          isSelected
                            ? 'bg-deadlock-hidden-king/20 border-deadlock-hidden-king text-white ring-1 ring-deadlock-hidden-king/50'
                            : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-white'
                        }`}
                      >
                        <HeroAvatar heroId={enemyId} size="xs" />
                        <span className="font-semibold text-[11px]">{getHeroById(enemyId)?.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. Lane Phase Outcome (Won / Even / Lost) */}
        {lane && (
          <div className="flex flex-col gap-2 pt-2 border-t border-deadlock-border/40">
            <span className="text-xs font-medium text-deadlock-muted">
              Lane Phase Result:
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(['won', 'even', 'lost'] as const).map((outcome) => (
                <button
                  key={outcome}
                  type="button"
                  onClick={() => setLaneOutcome(laneOutcome === outcome ? null : outcome)}
                  className={`py-1.5 px-3 rounded-lg border text-xs font-bold capitalize transition-all ${
                    laneOutcome === outcome
                      ? outcome === 'won'
                        ? 'bg-deadlock-win/20 border-deadlock-win text-deadlock-win shadow-sm'
                        : outcome === 'lost'
                        ? 'bg-deadlock-loss/20 border-deadlock-loss text-deadlock-loss shadow-sm'
                        : 'bg-yellow-500/20 border-yellow-500 text-yellow-300 shadow-sm'
                      : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted hover:text-white'
                  }`}
                >
                  {LANE_OUTCOME_LABELS[outcome]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

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
              <span>{isSubmitting ? 'Saving...' : editingMatch ? 'Update Match' : 'Save Match'}</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
