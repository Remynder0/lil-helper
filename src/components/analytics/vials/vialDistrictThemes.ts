import React from 'react';
import { YorkVialOverlay } from './YorkVialOverlay';
import { BroadwayVialOverlay } from './BroadwayVialOverlay';
import { GreenwichVialOverlay } from './GreenwichVialOverlay';

export interface DistrictVesselTheme {
  districtName: string;
  badgeColor: string;
  badgeBorder: string;
  vesselTitle: string;
  vesselSubtitle: string;
  districtLore: string;
  vialPath: string;
  glowColor: string;
  outlineColor: string;
  renderOverlay: (w: number, h: number) => React.ReactNode;
}

export const DISTRICT_VESSEL_THEMES: Record<'yellow' | 'blue' | 'green', DistrictVesselTheme> = {
  yellow: {
    districtName: 'York',
    badgeColor: 'text-amber-300 bg-amber-500/20',
    badgeBorder: 'border-amber-500/40',
    vesselTitle: 'Bullion Vault',
    vesselSubtitle: 'Fairfax Foundry',
    districtLore: 'Stock Exchange Warlocks & Pier 16 Foundries',
    vialPath:
      'path://M 26 4 L 62 4 L 62 14 L 68 14 L 74 26 L 74 144 L 66 166 L 68 184 L 20 184 L 22 166 L 14 144 L 14 26 L 20 14 L 26 14 Z',
    glowColor: 'rgba(234, 179, 8, 0.55)',
    outlineColor: 'rgba(234, 179, 8, 0.6)',
    renderOverlay: (w, h) => React.createElement(YorkVialOverlay, { width: w, height: h }),
  },
  blue: {
    districtName: 'Broadway',
    badgeColor: 'text-sky-300 bg-sky-500/20',
    badgeBorder: 'border-sky-500/40',
    vesselTitle: 'Neon Tube',
    vesselSubtitle: 'Times Sq. Subway',
    districtLore: 'Times Square Subway Vacuum Tube & High-Voltage Rail',
    vialPath:
      'path://M 26 10 L 62 10 C 64 10 64 14 62 16 L 58 18 L 58 158 A 14 14 0 0 1 30 158 L 30 18 L 26 16 C 24 14 24 10 26 10 Z',
    glowColor: 'rgba(56, 189, 248, 0.6)',
    outlineColor: 'rgba(56, 189, 248, 0.65)',
    renderOverlay: (w, h) => React.createElement(BroadwayVialOverlay, { width: w, height: h }),
  },
  green: {
    districtName: 'Greenwich',
    badgeColor: 'text-emerald-300 bg-emerald-500/20',
    badgeBorder: 'border-emerald-500/40',
    vesselTitle: 'Elm Cauldron',
    vesselSubtitle: 'Umbria Academy',
    districtLore: "300yo Hangman's Elm Roots & Umbria Grimoire Studies",
    vialPath:
      'path://M 30 4 L 58 4 C 62 4 64 8 62 14 L 54 20 L 54 48 C 66 65 76 88 76 124 C 76 166 64 184 44 184 C 24 184 12 166 12 124 C 12 88 22 65 34 48 L 34 20 L 26 14 C 24 8 26 4 30 4 Z',
    glowColor: 'rgba(52, 211, 153, 0.55)',
    outlineColor: 'rgba(52, 211, 153, 0.6)',
    renderOverlay: (w, h) => React.createElement(GreenwichVialOverlay, { width: w, height: h }),
  },
};
