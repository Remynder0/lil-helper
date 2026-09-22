import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Globe,
  Clock,
  Eye,
  Terminal,
  Trash2,
  Plus,
  Play,
  Pause,
  Copy,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  Gamepad2,
  ExternalLink,
  ChevronDown,
  Database,
  Radio,
} from 'lucide-react';
import { ApiLogEntry, subscribeToApiLogs, clearApiLogs } from '../services/apiLogger';
import {
  QueuedMatch,
  subscribeToMatchQueue,
  addMatchToQueue,
  removeMatchFromQueue,
  clearFinishedMatches,
  clearEntireMatchQueue,
  updateQueuedMatchStatus,
} from '../services/matchQueue';
import {
  OcrCaptureEntry,
  subscribeToOcrCaptures,
  clearOcrCaptures,
} from '../services/ocrHistory';
import {
  ParsedGameContext,
  LogEvent,
  detectDeadlockLogPath,
  readDeadlockLogEvents,
  saveDeadlockDebugLog,
} from '../services/logWatcher';
import {
  fetchPlayerRank,
  fetchSingleMatchResultById,
} from '../services/deadlockApi';
import { persistMatches } from '../services/storage';
import { scanEscapeMenuDraft, ScreenScanResult } from '../services/screenOcr';
import { HeroAvatar } from './HeroAvatar';
import { getHeroById } from '../data/heroes';
import { ConnectedProfile, Match, SIDE_LABELS } from '../types/match';
import { OcrInspectorModal } from './draft/OcrInspectorModal';
import artDecoCorner from '../assets/art-deco/corner.svg';

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
  const [expandedApiLogId, setExpandedApiLogId] = useState<string | null>(null);

  // 2. Match Queue State
  const [matchQueue, setMatchQueue] = useState<QueuedMatch[]>([]);
  const [manualMatchIdInput, setManualMatchIdInput] = useState<string>('');
  const [checkingMatchId, setCheckingMatchId] = useState<number | null>(null);

  // 3. OCR Captures State
  const [ocrCaptures, setOcrCaptures] = useState<OcrCaptureEntry[]>([]);
  const [isScanningOcr, setIsScanningOcr] = useState<boolean>(false);
  const [ocrScanError, setOcrScanError] = useState<string | null>(null);
  const [inspectingScanResult, setInspectingScanResult] = useState<ScreenScanResult | null>(null);

  // 4. Game Log Intelligence State
  const [logPath, setLogPath] = useState<string>(() => {
    return (
      localStorage.getItem('deadlock_custom_log_path') ||
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Deadlock\\game\\citadel\\console.log'
    );
  });
  const [isWatchingLogs, setIsWatchingLogs] = useState<boolean>(true);
  const [rawLogEvents, setRawLogEvents] = useState<LogEvent[]>([]);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [isPathValid, setIsPathValid] = useState<boolean | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Connecting to log watcher...');
  const [showRawTerminal, setShowRawTerminal] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedLog, setCopiedLog] = useState<boolean>(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

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

  // Auto-detect game log path on mount
  useEffect(() => {
    async function initLogPath() {
      const detected = await detectDeadlockLogPath();
      if (detected) {
        setLogPath(detected);
        localStorage.setItem('deadlock_custom_log_path', detected);
        setIsPathValid(true);
        setStatusMessage(`Auto-detected log: ${detected}`);
      }
    }
    initLogPath();
  }, []);

  // Fetch log events periodically
  const fetchGameLogs = async () => {
    if (!logPath.trim()) return;
    try {
      const lines = await readDeadlockLogEvents(logPath.trim(), 131072);
      setRawLogEvents(lines);
      setIsPathValid(true);
      setStatusMessage(`Active (${lines.length} lines parsed)`);
    } catch (err: any) {
      setIsPathValid(false);
      setStatusMessage(err?.message || 'Failed to read console.log. Check path and -condebug flag.');
    }
  };

  useEffect(() => {
    fetchGameLogs();
    if (!isWatchingLogs) return;

    const interval = setInterval(() => {
      fetchGameLogs();
    }, 2000);

    return () => clearInterval(interval);
  }, [logPath, isWatchingLogs]);

  // Scroll terminal to bottom
  useEffect(() => {
    if (autoScroll && showRawTerminal) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [rawLogEvents, autoScroll, showRawTerminal]);

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

  // Action: Add Match ID to Queue manually
  const handleAddManualMatch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = parseInt(manualMatchIdInput.trim(), 10);
    if (cleanId > 0) {
      addMatchToQueue(cleanId);
      setManualMatchIdInput('');
    }
  };

  // Action: Check/Import specific queued match immediately
  const handleCheckQueuedMatch = async (matchId: number) => {
    if (!profile?.accountId || checkingMatchId !== null) return;
    setCheckingMatchId(matchId);
    updateQueuedMatchStatus(matchId, 'syncing', 'Checking API now...');

    try {
      const result = await fetchSingleMatchResultById(matchId, profile.accountId);
      if (result.success) {
        updateQueuedMatchStatus(matchId, 'synced', 'Successfully imported into matches!', false);
        await persistMatches([result.match]);
        if (onMatchesUpdated) {
          onMatchesUpdated((prev) => {
            if (prev.some((m) => m.id === result.match.id || m.matchId === matchId)) {
              return prev;
            }
            return [result.match, ...prev].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
          });
        }
      } else if (result.error === 'not_ranked') {
        updateQueuedMatchStatus(matchId, 'not_ranked', 'Match is Casual / Unranked.', false);
      } else if (result.error === 'not_in_match') {
        updateQueuedMatchStatus(matchId, 'failed', 'Profile was not part of this match.', false);
      } else if (result.error === 'rate_limited') {
        updateQueuedMatchStatus(
          matchId,
          'failed',
          result.message || 'Rate limit reached (3 requests/hour). Quota cooldown active.',
          false
        );
      } else {
        updateQueuedMatchStatus(
          matchId,
          'failed',
          result.message || 'Not yet indexed by Valve API. Cooldown active.',
          true
        );
      }
    } catch (err: any) {
      updateQueuedMatchStatus(matchId, 'failed', err?.message || 'Network error.', true);
    } finally {
      setCheckingMatchId(null);
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
      setOcrScanError(err?.message || 'OCR scan failed. Make sure Deadlock is open with Escape menu visible.');
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

  // Copy raw terminal logs
  const handleCopyLogs = () => {
    const text = rawLogEvents.map((e) => `[${e.timestamp}] ${e.rawLine}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  // Download raw terminal logs
  const handleDownloadLogs = () => {
    const text = rawLogEvents.map((e) => `[${e.timestamp}] ${e.rawLine}`).join('\n');
    saveDeadlockDebugLog(logPath, text);
  };

  const filteredTerminalEvents = rawLogEvents.filter((ev) => {
    if (!filterQuery.trim()) return true;
    return ev.rawLine.toLowerCase().includes(filterQuery.toLowerCase());
  });

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
                Diagnostic & Logs Dashboard
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-deadlock-accent/20 border border-deadlock-accent/40 text-deadlock-accent font-bold">
                Live Telemetry
              </span>
            </div>
            <p className="text-xs text-deadlock-muted mt-0.5">
              Monitor real-time Deadlock API requests, pending match queue, OCR screen detections, and engine console logs.
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
              <Radio className={`w-3.5 h-3.5 text-deadlock-accent ${isPingingApi ? 'animate-spin' : ''}`} />
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
        {/* ========================================================================= */}
        {/* SECTION 1: LAST 10 API REQUESTS */}
        {/* ========================================================================= */}
        <div className="steam-glass steam-panel rounded-xl p-5 border border-deadlock-border/80 shadow-lg flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-deadlock-border/50 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-deadlock-dark border border-deadlock-border/60 text-deadlock-accent">
                <Globe className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
                  Dernières Requêtes vers l'API ({apiLogs.length}/10)
                </span>
                <span className="text-[10px] text-deadlock-muted">
                  HTTP telemetry to api.deadlock-api.com
                </span>
              </div>
            </div>

            {apiLogs.length > 0 && (
              <button
                type="button"
                onClick={clearApiLogs}
                className="p-1 text-deadlock-muted hover:text-deadlock-loss transition-colors"
                title="Clear API request history"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {apiLogs.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-deadlock-muted">
              <Radio className="w-6 h-6 opacity-40 animate-pulse" />
              <span className="text-xs">No recent API requests logged yet.</span>
              <span className="text-[11px] text-deadlock-muted/70">
                Click "Ping Rank API" or sync matches to see live requests appear here.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
              {apiLogs.map((req) => {
                const isExpanded = expandedApiLogId === req.id;
                const is2xx = req.status >= 200 && req.status < 300;
                const is429 = req.status === 429;

                return (
                  <div
                    key={req.id}
                    className="flex flex-col rounded-lg bg-deadlock-dark/60 border border-deadlock-border/50 hover:border-deadlock-brass/50 transition-colors overflow-hidden text-xs"
                  >
                    <div
                      onClick={() => setExpandedApiLogId(isExpanded ? null : req.id)}
                      className="p-2.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Status Code Badge */}
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                            is2xx
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                              : is429
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          {req.status === 0 ? 'NET ERR' : req.status}
                        </span>

                        <span className="font-mono text-gray-300 truncate text-[11px]" title={req.endpoint}>
                          {req.endpoint}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] font-mono text-deadlock-accent">
                          {req.durationMs}ms
                        </span>
                        <span className="text-[10px] font-mono text-deadlock-muted">
                          {req.timestamp}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-deadlock-muted transition-transform ${
                            isExpanded ? 'rotate-180 text-deadlock-steam' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* Expandable Details */}
                    {isExpanded && (
                      <div className="p-3 bg-deadlock-panel/90 border-t border-deadlock-border/60 flex flex-col gap-1.5 text-[11px] font-mono">
                        <div className="flex items-center justify-between text-deadlock-muted">
                          <span>Full URL:</span>
                          <span className="text-gray-300 truncate max-w-[320px]">{req.url}</span>
                        </div>
                        <div className="flex items-center justify-between text-deadlock-muted">
                          <span>Result:</span>
                          <span className={req.success ? 'text-emerald-300' : 'text-rose-300 font-bold'}>
                            {req.summary}
                          </span>
                        </div>
                        {req.error && (
                          <div className="p-2 rounded bg-rose-950/40 border border-rose-500/30 text-rose-300 mt-1">
                            Error: {req.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: MATCH QUEUE */}
        {/* ========================================================================= */}
        <div className="steam-glass steam-panel rounded-xl p-5 border border-deadlock-border/80 shadow-lg flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-deadlock-border/50 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-deadlock-dark border border-deadlock-border/60 text-deadlock-brass">
                <Database className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
                  File d'Attente de Match ({matchQueue.length})
                </span>
                <span className="text-[10px] text-deadlock-muted">
                  Matches awaiting Valve indexing or local verification
                </span>
              </div>
            </div>

            {matchQueue.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearFinishedMatches}
                  className="text-[10px] font-mono text-deadlock-accent hover:underline"
                  title="Clear completed matches from queue"
                >
                  Clear Done
                </button>
                <button
                  type="button"
                  onClick={clearEntireMatchQueue}
                  className="text-[10px] font-mono text-rose-400 hover:text-rose-300 hover:underline"
                  title="Clear entire queue"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Manual Match ID Input */}
          <form onSubmit={handleAddManualMatch} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Queue Match ID (e.g. 106929743)..."
              value={manualMatchIdInput}
              onChange={(e) => setManualMatchIdInput(e.target.value.replace(/[^0-9]/g, ''))}
              className="flex-1 bg-deadlock-dark/80 border border-deadlock-border rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-deadlock-muted/60 focus:outline-none focus:border-deadlock-accent font-mono transition-colors"
            />
            <button
              type="submit"
              disabled={!manualMatchIdInput.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-steampunk-primary text-black font-bold text-xs shadow-md disabled:opacity-50 transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Queue Match</span>
            </button>
          </form>

          {matchQueue.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-deadlock-muted">
              <CheckCircle2 className="w-6 h-6 opacity-40 text-emerald-400" />
              <span className="text-xs">Queue is clear: all detected matches are processed.</span>
              <span className="text-[11px] text-deadlock-muted/70">
                Matches detected in-game automatically join this queue while awaiting Valve API indexing.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
              {matchQueue.map((item) => {
                const elapsedMin = Math.round((Date.now() - item.detectedAt) / 60000);
                const isChecking = checkingMatchId === item.matchId;
                const isImported = matches.some(
                  (m) => m.matchId === item.matchId || m.id === String(item.matchId)
                );
                const displayStatus = isImported ? 'synced' : item.status;

                return (
                  <div
                    key={item.matchId}
                    className="p-3 rounded-lg bg-deadlock-dark/60 border border-deadlock-border/50 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-deadlock-steam">
                          #{item.matchId}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${
                            displayStatus === 'synced'
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : displayStatus === 'syncing'
                              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                              : displayStatus === 'not_ranked'
                              ? 'bg-zinc-500/20 border-zinc-500/40 text-zinc-300'
                              : displayStatus === 'failed'
                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                              : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                          }`}
                        >
                          {displayStatus.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[10px] text-deadlock-muted flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        Detected {elapsedMin}m ago
                        {item.message && <span className="text-gray-400 truncate">• {item.message}</span>}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.status !== 'synced' && (
                        <button
                          type="button"
                          onClick={() => handleCheckQueuedMatch(item.matchId)}
                          disabled={isChecking}
                          className="px-2.5 py-1 rounded bg-deadlock-card border border-deadlock-border hover:border-deadlock-brass text-[11px] text-deadlock-steam font-bold transition-all shadow-sm disabled:opacity-50"
                        >
                          {isChecking ? 'Checking...' : 'Check Now'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeMatchFromQueue(item.matchId)}
                        className="p-1 text-deadlock-muted hover:text-deadlock-loss transition-colors"
                        title="Remove from queue"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: LAST 10 OCR CAPTURES */}
      {/* ========================================================================= */}
      <div className="steam-glass steam-panel rounded-xl p-5 border border-deadlock-border/80 shadow-lg flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-deadlock-border/50 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-deadlock-dark border border-purple-500/40 text-purple-400">
              <Eye className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
                10 Dernières Captures OCR ({ocrCaptures.length}/10)
              </span>
              <span className="text-[10px] text-deadlock-muted">
                Escape menu team draft scans & text extraction history
              </span>
            </div>
          </div>

          {ocrCaptures.length > 0 && (
            <button
              type="button"
              onClick={clearOcrCaptures}
              className="p-1 text-deadlock-muted hover:text-deadlock-loss transition-colors"
              title="Clear OCR history"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {ocrCaptures.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-deadlock-muted">
            <Eye className="w-6 h-6 opacity-40 text-purple-400" />
            <span className="text-xs">No OCR captures recorded yet.</span>
            <span className="text-[11px] text-deadlock-muted/70">
              Use "Run Test OCR" above or use the Occult Eye button in the Draft Assistant to scan the Escape menu.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ocrCaptures.map((capture) => (
              <div
                key={capture.id}
                className="p-3.5 rounded-xl bg-deadlock-dark/60 border border-deadlock-border/50 hover:border-purple-500/40 transition-colors flex flex-col gap-2.5 relative group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-gray-200">
                      {capture.timestamp}
                    </span>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.2 rounded">
                      {capture.durationMs}ms
                    </span>
                  </div>

                  {capture.detectedSide && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                        capture.detectedSide === 'hidden_king'
                          ? 'bg-deadlock-hidden-king/20 border-deadlock-hidden-king/40 text-deadlock-hidden-king'
                          : 'bg-deadlock-archmother/20 border-deadlock-archmother/40 text-deadlock-archmother'
                      }`}
                    >
                      {SIDE_LABELS[capture.detectedSide]}
                    </span>
                  )}
                </div>

                {/* Allies & Enemies Avatars */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-deadlock-border/40">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-400">
                      Allies ({capture.allies.length})
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {capture.allies.length === 0 ? (
                        <span className="text-[10px] text-deadlock-muted italic">None</span>
                      ) : (
                        capture.allies.map((h) => (
                          <div key={h.id} title={h.name}>
                            <HeroAvatar heroId={h.id} size="xs" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-[10px] uppercase font-bold text-rose-400">
                      Enemies ({capture.enemies.length})
                    </span>
                    <div className="flex items-center gap-1 justify-end flex-wrap">
                      {capture.enemies.length === 0 ? (
                        <span className="text-[10px] text-deadlock-muted italic">None</span>
                      ) : (
                        capture.enemies.map((h) => (
                          <div key={h.id} title={h.name}>
                            <HeroAvatar heroId={h.id} size="xs" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer / Inspect Button */}
                <div className="flex items-center justify-between text-[10px] font-mono text-deadlock-muted pt-1 border-t border-deadlock-border/30">
                  <span>{capture.linesCount} text lines parsed</span>
                  <button
                    type="button"
                    onClick={() => handleInspectCapture(capture)}
                    className="text-deadlock-accent hover:text-white font-bold flex items-center gap-1"
                  >
                    <span>Inspect</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: GAME LOGS & RUNTIME TELEMETRY */}
      {/* ========================================================================= */}
      <div className="steam-glass steam-panel rounded-xl p-5 border border-deadlock-border/80 shadow-lg flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-deadlock-border/50 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-deadlock-dark border border-emerald-500/40 text-emerald-400">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
                Dernières Infos Récupérées dans les Logs du Jeu
              </span>
              <span className="text-[10px] text-deadlock-muted">
                Source 2 console telemetry extracted from console.log
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsWatchingLogs(!isWatchingLogs)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deadlock-dark border border-deadlock-border hover:border-deadlock-brass text-xs font-bold text-gray-200 transition-all shadow-sm"
              title={isWatchingLogs ? 'Pause log watcher polling' : 'Resume log watcher polling'}
            >
              {isWatchingLogs ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isWatchingLogs ? 'Pause Watcher' : 'Resume Watcher'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowRawTerminal(!showRawTerminal)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deadlock-dark border border-deadlock-border hover:border-deadlock-brass text-xs font-bold text-gray-200 transition-all shadow-sm"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>{showRawTerminal ? 'Hide Raw Console' : 'Show Raw Console'}</span>
            </button>
          </div>
        </div>

        {/* 5 Quick Extracted Game Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Player State */}
          <div className="p-3 rounded-xl bg-deadlock-dark/70 border border-deadlock-border/60 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-deadlock-muted">State</span>
            <div className="flex items-center gap-1.5 mt-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  gameContext.state === 'in_game'
                    ? 'bg-emerald-400 animate-ping'
                    : gameContext.state === 'hideout'
                    ? 'bg-amber-400'
                    : 'bg-zinc-500'
                }`}
              />
              <span className="text-xs font-bold text-deadlock-steam">
                {gameContext.stateLabel}
              </span>
            </div>
            <span className="text-[10px] font-mono text-deadlock-muted mt-1 truncate">
              {gameContext.playerName || 'No Player'}
            </span>
          </div>

          {/* 2. Active Hero */}
          <div className="p-3 rounded-xl bg-deadlock-dark/70 border border-deadlock-border/60 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-deadlock-muted">Active Hero</span>
            <div className="flex items-center gap-2 mt-1">
              {gameContext.myHeroId ? (
                <>
                  <HeroAvatar heroId={gameContext.myHeroId} size="xs" />
                  <span className="text-xs font-bold text-deadlock-steam truncate">
                    {gameContext.myHeroName}
                  </span>
                </>
              ) : (
                <span className="text-xs text-deadlock-muted italic">None detected</span>
              )}
            </div>
            <span className="text-[10px] font-mono text-deadlock-muted mt-1">
              {gameContext.myHeroId ? `Hero #${gameContext.myHeroId}` : 'Awaiting pick'}
            </span>
          </div>

          {/* 3. Assigned Lane */}
          <div className="p-3 rounded-xl bg-deadlock-dark/70 border border-deadlock-border/60 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-deadlock-muted">Assigned Lane</span>
            <div className="flex items-center gap-1.5 mt-1">
              {gameContext.assignedLane ? (
                <span
                  className={`text-xs font-bold capitalize ${
                    gameContext.assignedLane === 'yellow'
                      ? 'text-yellow-300'
                      : gameContext.assignedLane === 'blue'
                      ? 'text-blue-300'
                      : 'text-emerald-300'
                  }`}
                >
                  {gameContext.assignedLane} Lane
                </span>
              ) : (
                <span className="text-xs text-deadlock-muted italic">Unassigned</span>
              )}
            </div>
            <span className="text-[10px] font-mono text-deadlock-muted mt-1">
              {gameContext.assignedLane ? 'In Lane Phase' : 'None'}
            </span>
          </div>

          {/* 4. Match ID */}
          <div className="p-3 rounded-xl bg-deadlock-dark/70 border border-deadlock-border/60 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-deadlock-muted">Console Match ID</span>
            <div className="flex items-center gap-1.5 mt-1">
              {gameContext.matchId ? (
                <span className="text-xs font-mono font-bold text-deadlock-accent">
                  #{gameContext.matchId}
                </span>
              ) : (
                <span className="text-xs text-deadlock-muted italic">No active match</span>
              )}
            </div>
            <div className="mt-1">
              {gameContext.matchId && !matchQueue.some((q) => q.matchId === gameContext.matchId) ? (
                <button
                  type="button"
                  onClick={() =>
                    addMatchToQueue(
                      gameContext.matchId!,
                      Date.now(),
                      gameContext.myHeroId,
                      gameContext.myHeroName
                    )
                  }
                  className="text-[10px] text-deadlock-accent hover:underline font-bold"
                >
                  + Add to queue
                </button>
              ) : (
                <span className="text-[10px] font-mono text-deadlock-muted">
                  {gameContext.matchId ? 'In queue' : 'Awaiting match'}
                </span>
              )}
            </div>
          </div>

          {/* 5. Current Map */}
          <div className="p-3 rounded-xl bg-deadlock-dark/70 border border-deadlock-border/60 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-deadlock-muted">Active Map</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs font-mono font-bold text-deadlock-steam truncate">
                {gameContext.mapName || 'Offline'}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1 truncate">
              {isPathValid === true ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : isPathValid === false ? (
                <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
              ) : null}
              <span className="text-[10px] font-mono text-deadlock-muted truncate">
                {statusMessage}
              </span>
            </div>
          </div>
        </div>

        {/* Raw Log Terminal Drawer (collapsible) */}
        {showRawTerminal && (
          <div className="flex flex-col gap-2 pt-2 border-t border-deadlock-border/50 animate-fadeIn">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-deadlock-muted" />
                <input
                  type="text"
                  placeholder="Filter console log lines..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full bg-deadlock-dark/80 border border-deadlock-border rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-deadlock-accent font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-bold border ${
                    autoScroll
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-deadlock-dark border-deadlock-border text-deadlock-muted'
                  }`}
                >
                  Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyLogs}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-deadlock-dark border border-deadlock-border text-deadlock-muted hover:text-white text-[11px]"
                  title="Copy log to clipboard"
                >
                  {copiedLog ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadLogs}
                  className="p-1.5 rounded bg-deadlock-dark border border-deadlock-border text-deadlock-muted hover:text-white"
                  title="Download console.log snapshot"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="h-64 rounded-xl bg-black/90 border border-deadlock-border p-3 font-mono text-[11px] text-gray-300 overflow-y-auto space-y-1">
              {filteredTerminalEvents.length === 0 ? (
                <div className="p-4 text-center text-deadlock-muted">No log lines match filter.</div>
              ) : (
                filteredTerminalEvents.map((ev, idx) => (
                  <div key={idx} className="leading-relaxed hover:bg-white/5 px-1 rounded">
                    <span className="text-deadlock-muted mr-2 select-none">[{ev.timestamp}]</span>
                    <span
                      className={
                        ev.rawLine.includes('Error')
                          ? 'text-rose-400'
                          : ev.rawLine.includes('match_id')
                          ? 'text-deadlock-accent font-bold'
                          : ev.rawLine.includes('GameStateChanged')
                          ? 'text-emerald-400 font-bold'
                          : 'text-gray-300'
                      }
                    >
                      {ev.rawLine}
                    </span>
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        )}
      </div>

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
