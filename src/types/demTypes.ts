/**
 * Types partagés pour le parser de fichiers replay .dem (Source 2 / Deadlock).
 * Ces types correspondent 1:1 à la struct DemParseResult du backend Rust.
 */

export interface DemParseResult {
  matchId: number;
  durationSeconds: number;
  /** Date ISO approximative extraite du header du replay */
  dateIso: string;
  myHeroId: number;
  /** 2 = Hidden King, 3 = Archmother */
  myTeam: number;
  allies: number[];        // 5 hero IDs (équipe du joueur hors lui)
  enemies: number[];       // 6 hero IDs (équipe adverse)
  /** 2 = Hidden King, 3 = Archmother */
  winningTeam: number;
  /** Lane du joueur : 1=Yellow, 4=Blue, 6=Green */
  lane?: number;
  laneAllyId?: number;
  laneOpponents: number[]; // 1 ou 2 ennemis de ta lane
  /** Souls cumulés (ta lane + allié) à T≈720s pour calcul lane outcome */
  myLaneSoulsAt720?: number;
  /** Souls cumulés (ennemis de ta lane) à T≈720s */
  enemyLaneSoulsAt720?: number;
  /** Temps (en s) de destruction du guardian allié sur ta lane */
  myGuardianDestroyedAt?: number;
  /** Temps (en s) de destruction du guardian ennemi sur ta lane */
  enemyGuardianDestroyedAt?: number;
  /** Nombre total de joueurs trouvés (sanity check, attendu = 12) */
  playerCount: number;
}

/**
 * Contexte et données ranked calculées pour un import .dem.
 */
export interface RankedTodoContext {
  matchResult: 'win' | 'loss' | 'cancel';
  previousMatchDelta: number | null;
  previousMatchShields: number | null;
  /** Progression calculée automatiquement selon les règles Deadlock */
  calculated?: import('../services/rankedCalculator').CalculatedRankedProgression;
}

/**
 * Construit la note informative pour le match importé via .dem.
 */
export function buildRankedTodoNote(ctx: RankedTodoContext): string {
  if (ctx.calculated?.summaryNote) {
    return ctx.calculated.summaryNote;
  }

  const resultLabel =
    ctx.matchResult === 'win' ? 'Victory' :
    ctx.matchResult === 'loss' ? 'Defeat' :
    'Cancelled';

  const deltaStr = ctx.previousMatchDelta !== null
    ? `${ctx.previousMatchDelta > 0 ? '+' : ''}${ctx.previousMatchDelta} pts`
    : 'unknown';

  const shieldsStr = ctx.previousMatchShields !== null
    ? `${ctx.previousMatchShields} shield${ctx.previousMatchShields > 1 ? 's' : ''}`
    : 'unknown';

  return [
    `Inferred Ranked: ${resultLabel}`,
    `Previous match: ${deltaStr} | Remaining shields: ${shieldsStr}`,
  ].join('\n');
}

