import React, { useState, useEffect, useRef } from 'react';
import {
  Gamepad2,
  Pause,
  Play,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Search,
  Copy,
  Download,
} from 'lucide-react';
import {
  ParsedGameContext,
  LogEvent,
  detectDeadlockLogPath,
  readDeadlockLogEvents,
  saveDeadlockDebugLog,
} from '../../services/logs/logWatcher';
import { QueuedMatch, addMatchToQueue } from '../../services/logs/matchQueue';
import { HeroAvatar } from '../HeroAvatar';

interface ConsoleLogsPanelProps {
  gameContext: ParsedGameContext;
  matchQueue: QueuedMatch[];
}

export const ConsoleLogsPanel: React.FC<ConsoleLogsPanelProps> = ({
  gameContext,
  matchQueue,
}) => {
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
      setStatusMessage(
        err?.message || 'Failed to read console.log. Check path and -condebug flag.'
      );
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
            {isWatchingLogs ? (
              <Pause className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Play className="w-3.5 h-3.5 text-emerald-400" />
            )}
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
                  : gameContext.state === 'draft'
                  ? 'bg-amber-400 animate-pulse'
                  : gameContext.state === 'hideout'
                  ? 'bg-sky-400'
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
          <span className="text-[10px] uppercase font-bold text-deadlock-muted">
            Assigned Lane
          </span>
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
          <span className="text-[10px] uppercase font-bold text-deadlock-muted">
            Console Match ID
          </span>
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
            {gameContext.matchId &&
            !matchQueue.some((q) => q.matchId === gameContext.matchId) ? (
              <button
                type="button"
                onClick={() =>
                  addMatchToQueue(
                    gameContext.matchId!,
                    Date.now(),
                    gameContext.myHeroId,
                    gameContext.myHeroName,
                    'log'
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
              <div className="p-4 text-center text-deadlock-muted">
                No log lines match filter.
              </div>
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
  );
};
