import React, { useState, useEffect } from 'react';
import { Activity, Eye, AlertCircle, Radio } from 'lucide-react';
import { ApiLogEntry, subscribeToApiLogs } from '../../services/api/apiLogger';
import { QueuedMatch, subscribeToMatchQueue } from '../../services/logs/matchQueue';
import { OcrCaptureEntry, subscribeToOcrCaptures } from '../../services/ocr/ocrHistory';
import { ParsedGameContext } from '../../services/logs/logWatcher';
import { fetchPlayerRank } from '../../services/api/deadlockApi';
import { scanEscapeMenuDraft, ScreenScanResult } from '../../services/ocr/screenOcr';
import { getHeroById } from '../../data/heroes';
import { ConnectedProfile, Match } from '../../types/match';
import { OcrInspectorModal } from '../draft/OcrInspectorModal';
import { ApiTelemetryPanel } from './ApiTelemetryPanel';
import { MatchQueuePanel } from './MatchQueuePanel';
import { OcrHistoryPanel } from './OcrHistoryPanel';
import { ConsoleLogsPanel } from './ConsoleLogsPanel';
import artDecoCorner from '../../assets/art-deco/corner.svg';

interface LogDashboardViewProps {
  profile?: ConnectedProfile | null;
  gameContext: ParsedGameContext;
  matches: Match[];
  onMatchesUpdated?: (updater: (prev: Match[]) => Match[]) => void;
}

export const LogDashboardView: React.FC<LogDashboardViewProps> = ({
  profile,
  gameContext,
  matches,
  onMatchesUpdated,
}) => {
  // 1. API Logs State
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([]);
  const [isPingingApi, setIsPingingApi] = useState<boolean>(false);

  // 2. Match Queue State
  const [matchQueue, setMatchQueue] = useState<QueuedMatch[]>([]);

  // 3. OCR Captures State
  const [ocrCaptures, setOcrCaptures] = useState<OcrCaptureEntry[]>([]);
  const [isScanningOcr, setIsScanningOcr] = useState<boolean>(false);
  const [ocrScanError, setOcrScanError] = useState<string | null>(null);
  const [inspectingScanResult, setInspectingScanResult] = useState<ScreenScanResult | null>(null);

  // Subscriptions
  useEffect(() => {
    const unsubApi = subscribeToApiLogs((logs) => setApiLogs(logs.slice(0, 10)));
    const unsubQueue = subscribeToMatchQueue((queue) => setMatchQueue(queue));
    const unsubOcr = subscribeToOcrCaptures((captures) => setOcrCaptures(captures.slice(0, 10)));

    return () => {
      unsubApi();
      unsubQueue();
      unsubOcr();
    };
  }, []);

  // Action: Ping API for current account rank
  const handlePingRankApi = async () => {
    if (!profile?.accountId || isPingingApi) return;
    setIsPingingApi(true);
    try {
      await fetchPlayerRank(profile.accountId);
    } catch (err) {
      console.error('API ping failed:', err);
    } finally {
      setIsPingingApi(false);
    }
  };

  // Action: Run Test OCR Scan from dashboard
  const handleTestOcrScan = async () => {
    if (isScanningOcr) return;
    setIsScanningOcr(true);
    setOcrScanError(null);
    try {
      const result = await scanEscapeMenuDraft();
      setInspectingScanResult(result);
    } catch (err: any) {
      setOcrScanError(
        err?.message || 'OCR scan failed. Make sure Deadlock is open with Escape menu visible.'
      );
    } finally {
      setIsScanningOcr(false);
    }
  };

  // Open Inspector from saved OCR capture
  const handleInspectCapture = (entry: OcrCaptureEntry) => {
    const syntheticResult: ScreenScanResult = {
      allies: entry.allies
        .map((a) => getHeroById(a.id))
        .filter((h): h is NonNullable<typeof h> => Boolean(h)),
      enemies: entry.enemies
        .map((e) => getHeroById(e.id))
        .filter((h): h is NonNullable<typeof h> => Boolean(h)),
      detectedSide: entry.detectedSide,
      rawText: entry.rawText,
      capturedImage: entry.capturedImagePreview || '',
      lines: entry.rawText.split('\n').filter(Boolean),
      matchedWords: [],
      statusLog: entry.statusLog,
    };
    setInspectingScanResult(syntheticResult);
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-12">
      {/* 1. Header Banner */}
      <div className="steam-glass steam-panel rounded-2xl p-6 border border-deadlock-brass/50 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="absolute top-2 left-2 pointer-events-none opacity-30">
          <img src={artDecoCorner} alt="" className="w-8 h-8" />
        </div>
        <div className="absolute top-2 right-2 pointer-events-none opacity-30 -scale-x-100">
          <img src={artDecoCorner} alt="" className="w-8 h-8" />
        </div>

        <div className="flex items-center gap-4 z-10">
          <div className="w-12 h-12 rounded-xl bg-deadlock-dark border-2 border-deadlock-brass/70 shadow-lg flex items-center justify-center relative">
            <Activity className="w-6 h-6 text-deadlock-accent animate-pulse" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-display tracking-wide text-deadlock-steam">
                Diagnostic &amp; Logs Dashboard
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-deadlock-accent/20 border border-deadlock-accent/40 text-deadlock-accent font-bold">
                Live Telemetry
              </span>
            </div>
            <p className="text-xs text-deadlock-muted mt-0.5">
              Monitor real-time Deadlock API requests, pending match queue, OCR screen detections,
              and engine console logs.
            </p>
          </div>
        </div>

        {/* Global Quick Action */}
        <div className="flex items-center gap-3 z-10 w-full sm:w-auto">
          {profile?.accountId && (
            <button
              type="button"
              onClick={handlePingRankApi}
              disabled={isPingingApi}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-deadlock-dark border border-deadlock-border hover:border-deadlock-brass text-xs font-bold text-gray-200 hover:text-deadlock-steam transition-all shadow-md active:scale-95 disabled:opacity-50"
              title="Send a quick live ping request to the Deadlock API"
            >
              <Radio
                className={`w-3.5 h-3.5 text-deadlock-accent ${isPingingApi ? 'animate-spin' : ''}`}
              />
              <span>{isPingingApi ? 'Pinging...' : 'Ping Rank API'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleTestOcrScan}
            disabled={isScanningOcr}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-linear-to-b from-[#8b5da8] via-deadlock-arcane to-[#45285c] border border-[#b388eb] text-xs font-bold text-white shadow-md hover:brightness-110 transition-all active:scale-95 disabled:opacity-50"
            title="Perform a screen OCR scan right now"
          >
            <Eye className={`w-3.5 h-3.5 ${isScanningOcr ? 'animate-spin' : ''}`} />
            <span>{isScanningOcr ? 'Scanning OCR...' : 'Run Test OCR'}</span>
          </button>
        </div>
      </div>

      {ocrScanError && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{ocrScanError}</span>
          </div>
          <button
            type="button"
            onClick={() => setOcrScanError(null)}
            className="text-rose-300/70 hover:text-white ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid: 2 Columns for Sections 1 & 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ApiTelemetryPanel apiLogs={apiLogs} />
        <MatchQueuePanel
          profile={profile}
          matchQueue={matchQueue}
          matches={matches}
          onMatchesUpdated={onMatchesUpdated}
        />
      </div>

      {/* SECTION 3: LAST 10 OCR CAPTURES */}
      <OcrHistoryPanel
        ocrCaptures={ocrCaptures}
        onInspectCapture={handleInspectCapture}
      />

      {/* SECTION 4: GAME LOGS & RUNTIME TELEMETRY */}
      <ConsoleLogsPanel gameContext={gameContext} matchQueue={matchQueue} />

      {/* OCR Inspector Modal */}
      {inspectingScanResult && (
        <OcrInspectorModal
          isOpen={Boolean(inspectingScanResult)}
          onClose={() => setInspectingScanResult(null)}
          lastScanResult={inspectingScanResult}
        />
      )}
    </div>
  );
};
