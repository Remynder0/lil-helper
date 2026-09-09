import React, { useState } from 'react';
import { Match } from '../types/match';
import { HeroAvatar } from './HeroAvatar';
import { HeroPicker } from './HeroPicker';
import {
  calculateDraftRecommendations,
  HeroDraftRecommendation,
} from '../services/analytics';
import {
  Brain,
  RotateCcw,
  Sparkles,
  Users,
  Swords,
} from 'lucide-react';

interface DraftAssistantViewProps {
  matches: Match[];
}

type ActiveDraftSection = 'allies' | 'enemies';

export const DraftAssistantView: React.FC<DraftAssistantViewProps> = ({ matches }) => {
  const [allies, setAllies] = useState<number[]>([]);
  const [enemies, setEnemies] = useState<number[]>([]);
  const [activeSection, setActiveSection] = useState<ActiveDraftSection>('enemies');
  const [selectedHeroDetail, setSelectedHeroDetail] = useState<HeroDraftRecommendation | null>(null);

  // All unavailable heroes (already picked as ally or enemy)
  const unavailableHeroIds = [...allies, ...enemies];

  // Calculate real-time recommendations
  const recommendations = calculateDraftRecommendations(
    matches,
    allies,
    enemies,
    unavailableHeroIds
  );

  // Top recommended pick
  const topPick = recommendations.length > 0 ? recommendations[0] : null;

  // Handle hero selection in the picker
  const handleSelectHero = (heroId: number) => {
    // If hero is already in allies, remove it
    if (allies.includes(heroId)) {
      setAllies(allies.filter((id) => id !== heroId));
      return;
    }
    // If hero is already in enemies, remove it
    if (enemies.includes(heroId)) {
      setEnemies(enemies.filter((id) => id !== heroId));
      return;
    }

    // Otherwise add to active section
    if (activeSection === 'allies') {
      if (allies.length < 5) {
        const nextAllies = [...allies, heroId];
        setAllies(nextAllies);
        if (nextAllies.length === 5 && enemies.length < 6) {
          setActiveSection('enemies');
        }
      }
    } else if (activeSection === 'enemies') {
      if (enemies.length < 6) {
        const nextEnemies = [...enemies, heroId];
        setEnemies(nextEnemies);
        if (nextEnemies.length === 6 && allies.length < 5) {
          setActiveSection('allies');
        }
      }
    }
  };

  const handleResetDraft = () => {
    setAllies([]);
    setEnemies([]);
    setActiveSection('enemies');
    setSelectedHeroDetail(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER BANNER */}
      <div className="bg-deadlock-panel border border-deadlock-border/80 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-deadlock-accent/20 border border-deadlock-accent/40 flex items-center justify-center text-deadlock-accent">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
              Real-Time Draft Assistant & Recommendation Engine
            </h2>
            <p className="text-xs text-deadlock-muted">
              Select the enemy picks and your teammates as they are revealed to simulate the draft and get live optimal pick recommendations.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetDraft}
          disabled={allies.length === 0 && enemies.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-deadlock-border bg-deadlock-dark hover:bg-deadlock-border text-xs font-semibold text-deadlock-muted hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Draft</span>
        </button>
      </div>

      {/* TOP PICK HERO SPOTLIGHT (if draft has at least 1 hero picked) */}
      {topPick && (enemies.length > 0 || allies.length > 0) && (
        <div className="bg-gradient-to-r from-deadlock-accent/15 via-deadlock-panel to-deadlock-panel border border-deadlock-accent/40 rounded-xl p-5 relative overflow-hidden shadow-lg shadow-deadlock-accent/5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <HeroAvatar heroId={topPick.heroId} size="lg" isHighlighted />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-deadlock-win/20 text-deadlock-win text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 border border-deadlock-win/40">
                    <Sparkles className="w-3 h-3" /> #1 Recommended Pick
                  </span>
                  <span className="text-xs text-deadlock-muted capitalize">
                    {topPick.hero?.heroType || topPick.hero?.role}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white">{topPick.hero?.name}</h3>
                <p className="text-xs text-gray-300 max-w-xl font-medium">
                  {topPick.primaryReason}
                </p>
              </div>
            </div>

            {/* Score pill */}
            <div className="flex flex-col items-end justify-center bg-deadlock-dark/80 border border-deadlock-border px-4 py-2.5 rounded-xl">
              <span className="text-[10px] text-deadlock-muted uppercase tracking-wider font-bold">
                Pick Rating Score
              </span>
              <div className="text-3xl font-black text-deadlock-accent font-mono">
                {topPick.overallScore}
                <span className="text-sm font-normal text-deadlock-muted">/100</span>
              </div>
              <span className="text-[10px] text-deadlock-muted">
                {topPick.baselineWinRate}% personal WR ({topPick.totalGamesPiloted} games)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* DRAFT BOARD SLOTS (Allies vs Enemies) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Your Team Allies (Up to 5) */}
        <div
          onClick={() => setActiveSection('allies')}
          className={`bg-deadlock-panel border rounded-xl p-4 transition-all cursor-pointer ${
            activeSection === 'allies'
              ? 'border-deadlock-archmother ring-1 ring-deadlock-archmother/50 shadow-md shadow-deadlock-archmother/10'
              : 'border-deadlock-border/80 hover:border-deadlock-border'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-deadlock-archmother" />
              <h3 className="font-bold text-sm text-gray-200 uppercase tracking-wide">
                Allied Team Picks ({allies.length}/5)
              </h3>
            </div>
            {activeSection === 'allies' && (
              <span className="text-[10px] bg-deadlock-archmother/20 text-deadlock-archmother px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                Selecting
              </span>
            )}
          </div>

          <div className="grid grid-cols-5 gap-2">
            {[0, 1, 2, 3, 4].map((slotIdx) => {
              const heroId = allies[slotIdx] || null;
              return (
                <div
                  key={slotIdx}
                  className="flex flex-col items-center justify-center p-2 rounded-lg bg-deadlock-dark/60 border border-deadlock-border/60 min-h-[90px]"
                >
                  <HeroAvatar
                    heroId={heroId}
                    size="sm"
                    showName
                    onRemove={heroId ? () => setAllies(allies.filter((id) => id !== heroId)) : undefined}
                  />
                  {!heroId && (
                    <span className="text-[10px] text-deadlock-muted mt-1 font-mono">
                      Ally #{slotIdx + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Enemy Team (Up to 6) */}
        <div
          onClick={() => setActiveSection('enemies')}
          className={`bg-deadlock-panel border rounded-xl p-4 transition-all cursor-pointer ${
            activeSection === 'enemies'
              ? 'border-deadlock-hidden-king ring-1 ring-deadlock-hidden-king/50 shadow-md shadow-deadlock-hidden-king/10'
              : 'border-deadlock-border/80 hover:border-deadlock-border'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-deadlock-hidden-king" />
              <h3 className="font-bold text-sm text-gray-200 uppercase tracking-wide">
                Enemy Team Picks ({enemies.length}/6)
              </h3>
            </div>
            {activeSection === 'enemies' && (
              <span className="text-[10px] bg-deadlock-hidden-king/20 text-deadlock-hidden-king px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                Selecting
              </span>
            )}
          </div>

          <div className="grid grid-cols-6 gap-2">
            {[0, 1, 2, 3, 4, 5].map((slotIdx) => {
              const heroId = enemies[slotIdx] || null;
              return (
                <div
                  key={slotIdx}
                  className="flex flex-col items-center justify-center p-2 rounded-lg bg-deadlock-dark/60 border border-deadlock-border/60 min-h-[90px]"
                >
                  <HeroAvatar
                    heroId={heroId}
                    size="sm"
                    showName
                    onRemove={heroId ? () => setEnemies(enemies.filter((id) => id !== heroId)) : undefined}
                  />
                  {!heroId && (
                    <span className="text-[10px] text-deadlock-muted mt-1 font-mono">
                      Enemy #{slotIdx + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* HERO PICKER FOR ADDING PICKS */}
      <HeroPicker
        title={activeSection === 'allies' ? 'Pick Allied Teammates' : 'Pick Enemy Heroes'}
        subtitle="Click heroes to assign them to the currently active team slot"
        selectedHeroIds={activeSection === 'allies' ? allies : enemies}
        disabledHeroIds={activeSection === 'allies' ? enemies : allies}
        onSelectHero={handleSelectHero}
        accentColor={activeSection === 'allies' ? 'archmother' : 'hidden_king'}
      />

      {/* RECOMMENDATION RANKINGS TABLE */}
      <div className="bg-deadlock-panel border border-deadlock-border/80 rounded-xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-deadlock-border/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold tracking-wide uppercase text-gray-200">
              Hero Pick Recommendations ({recommendations.length} Candidates Available)
            </h3>
            <p className="text-xs text-deadlock-muted mt-0.5">
              Ranked from best to worst based on your personal match history, counter advantages, and ally synergies
            </p>
          </div>
          <span className="text-xs text-deadlock-muted">
            Click any row to inspect matchup details
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-deadlock-dark/60 text-deadlock-muted border-b border-deadlock-border/60">
              <tr>
                <th className="py-3 px-4 font-semibold">Rank & Hero</th>
                <th className="py-3 px-4 font-semibold text-center">Score</th>
                <th className="py-3 px-4 font-semibold">Historical Baseline</th>
                <th className="py-3 px-4 font-semibold">Enemy Matchup</th>
                <th className="py-3 px-4 font-semibold">Ally Synergy</th>
                <th className="py-3 px-4 font-semibold">Recommendation Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-deadlock-border/40">
              {recommendations.map((rec, index) => {
                const isTop3 = index < 3;
                const scoreColor =
                  rec.overallScore >= 60
                    ? 'text-deadlock-win bg-deadlock-win/10 border-deadlock-win/30'
                    : rec.overallScore <= 40
                    ? 'text-deadlock-loss bg-deadlock-loss/10 border-deadlock-loss/30'
                    : 'text-gray-300 bg-deadlock-dark border-deadlock-border';

                return (
                  <tr
                    key={rec.heroId}
                    onClick={() => setSelectedHeroDetail(rec)}
                    className="hover:bg-deadlock-dark/40 cursor-pointer transition-colors"
                  >
                    {/* Rank & Hero */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs font-mono ${
                            isTop3
                              ? 'bg-deadlock-accent text-white shadow-sm'
                              : 'bg-deadlock-dark text-deadlock-muted border border-deadlock-border'
                          }`}
                        >
                          #{index + 1}
                        </span>
                        <HeroAvatar heroId={rec.heroId} size="xs" />
                        <div>
                          <div className="font-bold text-gray-200 text-sm">
                            {rec.hero?.name}
                          </div>
                          <div className="text-[11px] text-deadlock-muted capitalize">
                            {rec.hero?.heroType || rec.hero?.role}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Overall Score Badge */}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-lg font-mono font-black text-xs border ${scoreColor}`}>
                        {rec.overallScore} / 100
                      </span>
                    </td>

                    {/* Personal Baseline */}
                    <td className="py-3 px-4 font-mono">
                      {rec.totalGamesPiloted > 0 ? (
                        <div>
                          <span className={rec.baselineWinRate >= 50 ? 'text-deadlock-win font-bold' : 'text-deadlock-loss font-bold'}>
                            {rec.baselineWinRate}% WR
                          </span>
                          <div className="text-[10px] text-deadlock-muted">
                            {rec.totalGamesPiloted} game{rec.totalGamesPiloted !== 1 ? 's' : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-deadlock-muted text-[11px]">Unplayed (50%)</span>
                      )}
                    </td>

                    {/* Enemy Matchup */}
                    <td className="py-3 px-4 font-mono">
                      {rec.enemyMatchupScore !== null ? (
                        <span className={rec.enemyMatchupScore >= 50 ? 'text-deadlock-win font-bold' : 'text-deadlock-loss font-bold'}>
                          {rec.enemyMatchupScore}% WR
                        </span>
                      ) : (
                        <span className="text-deadlock-muted text-[11px]">—</span>
                      )}
                    </td>

                    {/* Ally Synergy */}
                    <td className="py-3 px-4 font-mono">
                      {rec.allySynergyScore !== null ? (
                        <span className={rec.allySynergyScore >= 50 ? 'text-deadlock-win font-bold' : 'text-deadlock-loss font-bold'}>
                          {rec.allySynergyScore}% WR
                        </span>
                      ) : (
                        <span className="text-deadlock-muted text-[11px]">—</span>
                      )}
                    </td>

                    {/* Primary Reason */}
                    <td className="py-3 px-4">
                      <div className="text-xs text-gray-300 font-medium line-clamp-1">
                        {rec.primaryReason}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL / DRAWER FOR DETAILED BREAKDOWN OF A SELECTED HERO */}
      {selectedHeroDetail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-deadlock-panel border border-deadlock-border rounded-xl max-w-lg w-full p-6 flex flex-col gap-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-deadlock-border pb-3">
              <div className="flex items-center gap-3">
                <HeroAvatar heroId={selectedHeroDetail.heroId} size="md" />
                <div>
                  <h3 className="font-black text-lg text-white">
                    {selectedHeroDetail.hero?.name}
                  </h3>
                  <div className="text-xs text-deadlock-muted">
                    Rating Score: <strong className="text-deadlock-accent">{selectedHeroDetail.overallScore}/100</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHeroDetail(null)}
                className="text-deadlock-muted hover:text-white text-xs px-2.5 py-1 rounded bg-deadlock-dark border border-deadlock-border"
              >
                Close
              </button>
            </div>

            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {/* Summary sentence */}
              <div className="bg-deadlock-dark/60 p-3 rounded-lg border border-deadlock-border/60 text-xs text-gray-200">
                <strong className="text-deadlock-accent">Analysis: </strong>
                {selectedHeroDetail.primaryReason}
              </div>

              {/* Enemy Details */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-2 flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-deadlock-hidden-king" />
                  <span>Matchups Against Current Enemies:</span>
                </h4>
                {selectedHeroDetail.enemyDetails.length === 0 ? (
                  <p className="text-xs text-deadlock-muted italic">
                    No historical matches recorded when playing {selectedHeroDetail.hero?.name} against the selected enemy heroes.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedHeroDetail.enemyDetails.map((ed) => (
                      <div
                        key={ed.enemyHeroId}
                        className="flex items-center justify-between p-2 rounded bg-deadlock-dark border border-deadlock-border/40 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <HeroAvatar heroId={ed.enemyHeroId} size="xs" />
                          <span className="font-semibold text-gray-200">{ed.enemyHeroName}</span>
                        </div>
                        <div className="flex items-center gap-3 font-mono">
                          <span className={ed.advantage >= 0 ? 'text-deadlock-win font-bold' : 'text-deadlock-loss font-bold'}>
                            {ed.winRate}% WR
                          </span>
                          <span className="text-[10px] text-deadlock-muted">
                            ({ed.matches} game{ed.matches !== 1 ? 's' : ''})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ally Details */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-deadlock-archmother" />
                  <span>Synergies Alongside Current Allies:</span>
                </h4>
                {selectedHeroDetail.allyDetails.length === 0 ? (
                  <p className="text-xs text-deadlock-muted italic">
                    No historical matches recorded when playing {selectedHeroDetail.hero?.name} with the selected allied heroes.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedHeroDetail.allyDetails.map((ad) => (
                      <div
                        key={ad.allyHeroId}
                        className="flex items-center justify-between p-2 rounded bg-deadlock-dark border border-deadlock-border/40 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <HeroAvatar heroId={ad.allyHeroId} size="xs" />
                          <span className="font-semibold text-gray-200">{ad.allyHeroName}</span>
                        </div>
                        <div className="flex items-center gap-3 font-mono">
                          <span className={ad.synergy >= 0 ? 'text-deadlock-win font-bold' : 'text-deadlock-loss font-bold'}>
                            {ad.winRate}% WR
                          </span>
                          <span className="text-[10px] text-deadlock-muted">
                            ({ad.matches} game{ad.matches !== 1 ? 's' : ''})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
