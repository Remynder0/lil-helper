import { describe, it, expect } from 'vitest';
import {
  computeRankedShieldEvents,
  getRankTierFromFlatProgress,
} from '../components/ranked/RankedProgressionView';
import { getMaxShieldsForRank, processRankedMatches } from '../services/ranked/rankedChart';
import { Match } from '../types/match';

describe('computeRankedShieldEvents', () => {
  const createMockMatch = (partial: Partial<Match>): Match => ({
    id: 'match_' + Math.random().toString(36).substring(7),
    date: '2026-10-01T12:00:00.000Z',
    side: 'hidden_king',
    myHeroId: 1,
    allies: [2, 3, 4, 5, 6],
    enemies: [7, 8, 9, 10, 11, 12],
    result: 'win',
    ...partial,
  });

  it('marks promotions with type: gained and correct shield resets (5 for subranks I & II, 2 for subranks III-VI)', () => {
    const matches: Match[] = [
      createMockMatch({
        id: 'm1',
        date: '2026-10-01T10:00:00.000Z',
        result: 'win',
        rankedBadge: 86,
        rankedRank: 8,
        rankedSubrank: 6,
        rankedProgress: 55400,
        rankedDelta: 300,
      }),
      createMockMatch({
        id: 'm2',
        date: '2026-10-01T11:00:00.000Z',
        result: 'win',
        rankedBadge: 91,
        rankedRank: 9,
        rankedSubrank: 1,
        rankedProgress: 56400,
        rankedDelta: 300,
        rankedDemotionProtection: 5,
      }),
      createMockMatch({
        id: 'm3',
        date: '2026-10-01T12:00:00.000Z',
        result: 'win',
        rankedBadge: 92,
        rankedRank: 9,
        rankedSubrank: 2,
        rankedProgress: 57000,
        rankedDelta: 300,
        rankedDemotionProtection: 5,
      }),
      createMockMatch({
        id: 'm4',
        date: '2026-10-01T13:00:00.000Z',
        result: 'win',
        rankedBadge: 93,
        rankedRank: 9,
        rankedSubrank: 3,
        rankedProgress: 58000,
        rankedDelta: 300,
        rankedDemotionProtection: 2,
      }),
    ];

    const { events } = computeRankedShieldEvents(matches);

    // Promotion from badge 86 to 91 (Subrank 1): 5 shields
    const m2Event = events.get('m2');
    expect(m2Event).toBeDefined();
    expect(m2Event?.type).toBe('gained');
    expect(m2Event?.count).toBe(5);
    expect(m2Event?.subrankLabel).toBe('Phantom I');

    // Promotion from badge 91 to 92 (Subrank 2): 5 shields
    const m3Event = events.get('m3');
    expect(m3Event).toBeDefined();
    expect(m3Event?.type).toBe('gained');
    expect(m3Event?.count).toBe(5);
    expect(m3Event?.subrankLabel).toBe('Phantom II');

    // Promotion from badge 92 to 93 (Subrank 3): 2 shields
    const m4Event = events.get('m4');
    expect(m4Event).toBeDefined();
    expect(m4Event?.type).toBe('gained');
    expect(m4Event?.count).toBe(2);
    expect(m4Event?.subrankLabel).toBe('Phantom III');
  });

  it('marks demotions with type: gained and resets shields (5 for subranks I & II, 2 for subranks III-VI)', () => {
    const matches: Match[] = [
      createMockMatch({
        id: 'm1',
        date: '2026-10-01T10:00:00.000Z',
        result: 'loss',
        rankedBadge: 93,
        rankedRank: 9,
        rankedSubrank: 3,
        rankedProgress: 58000,
        rankedDelta: 0,
        rankedDemotionProtection: 0,
        rankedConsumedDemotionProtection: true,
      }),
      createMockMatch({
        id: 'm2',
        date: '2026-10-01T11:00:00.000Z',
        result: 'loss',
        rankedBadge: 92,
        rankedRank: 9,
        rankedSubrank: 2,
        rankedProgress: 57400,
        rankedDelta: -300,
        rankedDemotionProtection: 5,
        rankedConsumedDemotionProtection: false,
      }),
      createMockMatch({
        id: 'm3',
        date: '2026-10-01T12:00:00.000Z',
        result: 'loss',
        rankedBadge: 91,
        rankedRank: 9,
        rankedSubrank: 1,
        rankedProgress: 56400,
        rankedDelta: -300,
        rankedDemotionProtection: 5,
        rankedConsumedDemotionProtection: false,
      }),
      createMockMatch({
        id: 'm4',
        date: '2026-10-01T13:00:00.000Z',
        result: 'loss',
        rankedBadge: 86,
        rankedRank: 8,
        rankedSubrank: 6,
        rankedProgress: 55400,
        rankedDelta: -300,
        rankedDemotionProtection: 2,
        rankedConsumedDemotionProtection: false,
      }),
    ];

    const { events } = computeRankedShieldEvents(matches);

    // Demotion 93 -> 92 (Phantom III -> Phantom II: Subrank 2 gets 5 shields reset)
    const m2Event = events.get('m2');
    expect(m2Event).toBeDefined();
    expect(m2Event?.type).toBe('gained');
    expect(m2Event?.count).toBe(5);
    expect(m2Event?.subrankLabel).toBe('Phantom II');

    // Demotion 92 -> 91 (Phantom II -> Phantom I: Subrank 1 gets 5 shields reset)
    const m3Event = events.get('m3');
    expect(m3Event).toBeDefined();
    expect(m3Event?.type).toBe('gained');
    expect(m3Event?.count).toBe(5);
    expect(m3Event?.subrankLabel).toBe('Phantom I');

    // Demotion 91 -> 86 (Phantom I -> Oracle VI: Subrank 6 gets 2 shields reset)
    const m4Event = events.get('m4');
    expect(m4Event).toBeDefined();
    expect(m4Event?.type).toBe('gained');
    expect(m4Event?.count).toBe(2);
    expect(m4Event?.subrankLabel).toBe('Oracle VI');
  });

  it('generates shield consumption events for all defeats with delta 0 at floor', () => {
    const matches: Match[] = [
      createMockMatch({
        id: 'm1',
        date: '2026-10-01T10:00:00.000Z',
        result: 'loss',
        rankedBadge: 92,
        rankedRank: 9,
        rankedSubrank: 2,
        rankedInitialProgress: 57000,
        rankedProgress: 57000,
        rankedDelta: 0,
        rankedDemotionProtection: 4,
        rankedConsumedDemotionProtection: true,
      }),
      createMockMatch({
        id: 'm2',
        date: '2026-10-01T11:00:00.000Z',
        result: 'loss',
        rankedBadge: 92,
        rankedRank: 9,
        rankedSubrank: 2,
        rankedInitialProgress: 57000,
        rankedProgress: 57000,
        rankedDelta: 0,
        rankedDemotionProtection: 3,
        rankedConsumedDemotionProtection: true,
      }),
      createMockMatch({
        id: 'm3',
        date: '2026-10-01T12:00:00.000Z',
        result: 'loss',
        rankedBadge: 92,
        rankedRank: 9,
        rankedSubrank: 2,
        rankedInitialProgress: 57000,
        rankedProgress: 57000,
        rankedDelta: 0,
        rankedDemotionProtection: 2,
        rankedConsumedDemotionProtection: true,
      }),
    ];

    const { events } = computeRankedShieldEvents(matches);

    expect(events.get('m1')?.type).toBe('used');
    expect(events.get('m1')?.count).toBe(-1);

    expect(events.get('m2')?.type).toBe('used');
    expect(events.get('m2')?.count).toBe(-1);

    expect(events.get('m3')?.type).toBe('used');
    expect(events.get('m3')?.count).toBe(-1);
  });

  it('correctly maps flat progress values to exact ladder ranks (Oracle V at 53k, Phantom I at 56k)', () => {
    expect(getRankTierFromFlatProgress(49000).label).toBe('Oracle I');
    expect(getRankTierFromFlatProgress(53000).label).toBe('Oracle V');
    expect(getRankTierFromFlatProgress(54000).label).toBe('Oracle VI');
    expect(getRankTierFromFlatProgress(55000).label).toBe('Oracle VI'); // Subrank 6 is 2000 pts (54k to 56k)
    expect(getRankTierFromFlatProgress(56000).label).toBe('Phantom I');
    expect(getRankTierFromFlatProgress(57000).label).toBe('Phantom II');
    expect(getRankTierFromFlatProgress(58000).label).toBe('Phantom III');
    expect(getRankTierFromFlatProgress(59000).label).toBe('Phantom IV');
    expect(getRankTierFromFlatProgress(60000).label).toBe('Phantom V');
    expect(getRankTierFromFlatProgress(61000).label).toBe('Phantom VI');
    expect(getRankTierFromFlatProgress(62000).label).toBe('Phantom VI');
    expect(getRankTierFromFlatProgress(63000).label).toBe('Ascendant I');
  });

  it('preserves authentic match progress across unrecorded match gaps without artificial overwrites', () => {
    const matches: Match[] = [
      createMockMatch({
        id: 'm1',
        date: '2026-10-01T10:00:00.000Z',
        result: 'loss',
        rankedBadge: 92,
        rankedRank: 9,
        rankedSubrank: 2,
        rankedInitialProgress: 57000,
        rankedProgress: 57000,
        rankedDelta: 0,
        rankedDemotionProtection: 1,
        rankedConsumedDemotionProtection: true,
      }),
      // Unrecorded games gap: player lost 600 pts between m1 and m2
      createMockMatch({
        id: 'm2',
        date: '2026-10-01T14:00:00.000Z',
        result: 'loss',
        rankedBadge: 91,
        rankedRank: 9,
        rankedSubrank: 1,
        rankedInitialProgress: 56400,
        rankedProgress: 56100,
        rankedDelta: -300,
        rankedDemotionProtection: 4,
      }),
    ];

    const { events } = computeRankedShieldEvents(matches);
    expect(events.get('m1')?.type).toBe('used');
    expect(matches[0].rankedProgress).toBe(57000);
    expect(matches[1].rankedInitialProgress).toBe(56400);
    // Gap detected between m1 endProgress (57000) and m2 startProgress (56400) = -600 pts
    const gap = matches[1].rankedInitialProgress! - matches[0].rankedProgress!;
    expect(gap).toBe(-600);
  });

  it('applies shield reset and consumption on the exact match without a 1-game offset when rankedBadge holds initial_display_rank', () => {
    const matches: Match[] = [
      // m1: starts in Phantom I (badge 91, 56970 pts) and promotes to Phantom II (57270 pts)
      createMockMatch({
        id: 'm1_promote',
        date: '2026-10-01T10:00:00.000Z',
        result: 'win',
        rankedBadge: 91, // initial_display_rank before m1
        rankedRank: 9,
        rankedSubrank: 1,
        rankedInitialProgress: 56970,
        rankedProgress: 57270,
        rankedDelta: 300,
        rankedDemotionProtection: 5,
        rankedConsumedDemotionProtection: false,
      }),
      // m2: starts in Phantom II (badge 92, 57270 pts), loses 270 pts clamped at 57000 floor -> consumes 1st shield
      createMockMatch({
        id: 'm2_consume1',
        date: '2026-10-01T11:00:00.000Z',
        result: 'loss',
        rankedBadge: 92,
        rankedRank: 9,
        rankedSubrank: 2,
        rankedInitialProgress: 57270,
        rankedProgress: 57000,
        rankedDelta: -270,
        rankedDemotionProtection: 5,
        rankedConsumedDemotionProtection: true,
      }),
      // m3: wins +300 pts (57000 -> 57300)
      createMockMatch({
        id: 'm3_win',
        date: '2026-10-01T12:00:00.000Z',
        result: 'win',
        rankedBadge: 92,
        rankedRank: 9,
        rankedSubrank: 2,
        rankedInitialProgress: 57000,
        rankedProgress: 57300,
        rankedDelta: 300,
        rankedDemotionProtection: 4,
        rankedConsumedDemotionProtection: false,
      }),
      // m4: normal -300 loss landing exactly on floor (57300 -> 57000) with consumed_demotion_protection: false -> MUST NOT consume a shield early!
      createMockMatch({
        id: 'm4_loss_to_floor_no_shield',
        date: '2026-10-01T13:00:00.000Z',
        result: 'loss',
        rankedBadge: 92,
        rankedRank: 9,
        rankedSubrank: 2,
        rankedInitialProgress: 57300,
        rankedProgress: 57000,
        rankedDelta: -300,
        rankedDemotionProtection: 4,
        rankedConsumedDemotionProtection: false,
      }),
      // m5: loss at floor (57000 -> 57000) -> consumes 2nd shield on this exact match
      createMockMatch({
        id: 'm5_consume2',
        date: '2026-10-01T14:00:00.000Z',
        result: 'loss',
        rankedBadge: 92,
        rankedRank: 9,
        rankedSubrank: 2,
        rankedInitialProgress: 57000,
        rankedProgress: 57000,
        rankedDelta: 0,
        rankedDemotionProtection: 4,
        rankedConsumedDemotionProtection: true,
      }),
    ];

    const { processedMatches, shieldEventsMap } = processRankedMatches(matches);

    // m1: Promotion shield reset happens on m1 itself (not delayed to m2!)
    expect(shieldEventsMap.get('m1_promote')?.type).toBe('gained');
    expect(shieldEventsMap.get('m1_promote')?.subrankLabel).toBe('Phantom II');
    expect(processedMatches[0].runningShields).toBe(5);

    // m2: Shield consumption happens on m2 itself (not overwritten by delayed promotion!)
    expect(shieldEventsMap.get('m2_consume1')?.type).toBe('used');
    expect(processedMatches[1].runningShields).toBe(4);

    // m4: Normal -300 loss landing on 57000 does NOT consume a shield early
    expect(shieldEventsMap.get('m4_loss_to_floor_no_shield')).toBeUndefined();
    expect(processedMatches[3].runningShields).toBe(4);

    // m5: Shield consumption happens on m5
    expect(shieldEventsMap.get('m5_consume2')?.type).toBe('used');
    expect(processedMatches[4].runningShields).toBe(3);
  });

  it('disables the shield system in ranks above Eternus I (Eternus II–VI)', () => {
    expect(getMaxShieldsForRank(11, 1)).toBe(5);
    expect(getMaxShieldsForRank(11, 2)).toBe(0);
    expect(getMaxShieldsForRank(11, 6)).toBe(0);

    const matches: Match[] = [
      createMockMatch({
        id: 'e1',
        date: '2026-10-01T10:00:00.000Z',
        result: 'win',
        rankedBadge: 111,
        rankedRank: 11,
        rankedSubrank: 1,
        rankedInitialProgress: 70200,
        rankedProgress: 70500,
        rankedDelta: 300,
        rankedDemotionProtection: 5,
      }),
      createMockMatch({
        id: 'e2',
        date: '2026-10-01T11:00:00.000Z',
        result: 'win',
        rankedBadge: 112,
        rankedRank: 11,
        rankedSubrank: 2,
        rankedInitialProgress: 70500,
        rankedProgress: 70800,
        rankedDelta: 300,
        rankedDemotionProtection: 5,
      }),
    ];

    const { processedMatches, shieldEventsMap } = processRankedMatches(matches);
    // Above Eternus I (subrank 2), runningShields is 0 and no shield reset event is emitted
    expect(processedMatches[1].subrank).toBe(2);
    expect(processedMatches[1].runningShields).toBe(0);
    expect(shieldEventsMap.get('e2')).toBeUndefined();
  });
});
