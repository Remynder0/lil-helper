import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Play,
  Pause,
  RefreshCw,
  Download,
  Copy,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  FolderSearch,
  Gamepad2,
  Info,
} from 'lucide-react';
import {
  LogEvent,
  detectDeadlockLogPath,
  readDeadlockLogEvents,
  saveDeadlockDebugLog,
} from '../services/logWatcher';

interface GameLogMonitorProps {
  onMatchDetected?: (matchId: number) => void;
}

export const GameLogMonitor: React.FC<GameLogMonitorProps> = ({ onMatchDetected }) => {
  const [logPath, setLogPath] = useState<string>(() => {
    return (
      localStorage.getItem('deadlock_custom_log_path') ||
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Deadlock\\game\\citadel\\console.log'
    );
  });
  const [isWatching, setIsWatching] = useState<boolean>(true);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing log watcher...');
  const [isPathValid, setIsPathValid] = useState<boolean | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [detectedMatchId, setDetectedMatchId] = useState<number | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-detect path on initial mount
  useEffect(() => {
    async function autoDetect() {
      const detected = await detectDeadlockLogPath();
      if (detected) {
        setLogPath(detected);
        localStorage.setItem('deadlock_custom_log_path', detected);
        setIsPathValid(true);
        setStatusMessage(`Auto-detected log at: ${detected}`);
      }
    }
    autoDetect();
  }, []);

  // Fetch log lines
  const fetchLogs = async () => {
    if (!logPath.trim()) return;
    try {
      const lines = await readDeadlockLogEvents(logPath.trim(), 131072); // 128KB
      setEvents(lines);
      setIsPathValid(true);
      setStatusMessage(`Active (${lines.length} lines read)`);

      // Search for match ID in lines
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].rawLine;
        const matchRegex = /match[_\s]?id[:=\s]+(\d{6,10})/i;
        const match = line.match(matchRegex);
        if (match && match[1]) {
          const idNum = parseInt(match[1], 10);
          if (idNum > 0 && idNum !== detectedMatchId) {
            setDetectedMatchId(idNum);
            if (onMatchDetected) {
              onMatchDetected(idNum);
            }
          }
          break;
        }
      }
    } catch (err: any) {
      setIsPathValid(false);
      setStatusMessage(err?.message || 'Failed to read log file. Check path and -condebug flag.');
    }
  };

  // Polling loop
  useEffect(() => {
    fetchLogs();
    if (!isWatching) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, 2000);

    return () => clearInterval(interval);
  }, [logPath, isWatching, detectedMatchId]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  const handleDetectClick = async () => {
    setStatusMessage('Searching common Steam drives...');
    const detected = await detectDeadlockLogPath();
    if (detected) {
      setLogPath(detected);
      localStorage.setItem('deadlock_custom_log_path', detected);
      setIsPathValid(true);
      setStatusMessage(`Found: ${detected}`);
      fetchLogs();
    } else {
      setStatusMessage('Log not found automatically. Please enter manual path.');
    }
  };

  const handleCopyAll = () => {
    const text = events.map((e) => `[${e.timestamp}] ${e.rawLine}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportToFile = async () => {
    const text = events.map((e) => `[${e.timestamp}] [${e.eventType.toUpperCase()}] ${e.rawLine}`).join('\n');
    const targetFile = 'deadlock_debug_log.txt';
    try {
      await saveDeadlockDebugLog(targetFile, text);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredEvents = events.filter((e) => {
    if (filterType !== 'all' && e.eventType !== filterType) return false;
    if (filterQuery.trim()) {
      return e.rawLine.toLowerCase().includes(filterQuery.toLowerCase());
    }
    return true;
  });

  const matchEventCount = events.filter((e) => e.eventType === 'match_found').length;
  const heroEventCount = events.filter((e) => e.eventType === 'hero_detected').length;

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto pb-12">
      {/* Header Info */}
      <div className="bg-deadlock-card border border-deadlock-border rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-deadlock-steam font-heading">
                  Deadlock Live Log & Event Debugger
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  VAC-Safe (-condebug)
                </span>
              </div>
              <p className="text-xs text-deadlock-muted mt-1 leading-relaxed max-w-2xl">
                Monitors Deadlock's internal Source 2 console logs in real time to capture live match
                connections, draft picks, and game transitions without any game memory injection.
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-3 self-start lg:self-center">
            <div className="px-3 py-2 rounded-lg bg-deadlock-dark border border-deadlock-border text-center min-w-[90px]">
              <div className="text-[10px] uppercase font-bold text-deadlock-muted">Captured Lines</div>
              <div className="text-base font-black text-deadlock-steam font-mono">{events.length}</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-deadlock-dark border border-deadlock-border text-center min-w-[90px]">
              <div className="text-[10px] uppercase font-bold text-deadlock-muted">Match Events</div>
              <div className="text-base font-black text-deadlock-archmother font-mono">
                {matchEventCount}
              </div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-deadlock-dark border border-deadlock-border text-center min-w-[90px]">
              <div className="text-[10px] uppercase font-bold text-deadlock-muted">Hero Events</div>
              <div className="text-base font-black text-deadlock-hidden-king font-mono">
                {heroEventCount}
              </div>
            </div>
          </div>
        </div>

        {/* -condebug instructions callout */}
        <div className="mt-4 pt-4 border-t border-deadlock-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-deadlock-dark/60 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-gray-300">
            <Info className="w-4 h-4 text-deadlock-accent shrink-0" />
            <span>
              <strong>Setup instruction:</strong> In Steam &gt; Right-click Deadlock &gt; Properties &gt;
              Launch Options, add <code className="px-1.5 py-0.5 bg-black rounded text-deadlock-accent font-mono">-condebug</code>
            </span>
          </div>
          {detectedMatchId && (
            <div className="flex items-center gap-2 shrink-0 bg-deadlock-win/10 text-deadlock-win border border-deadlock-win/30 px-3 py-1 rounded-md">
              <Gamepad2 className="w-3.5 h-3.5" />
              <span className="font-bold font-mono">Live Match ID: {detectedMatchId}</span>
            </div>
          )}
        </div>
      </div>

      {/* Log File Path & Stream Controls Bar */}
      <div className="bg-deadlock-card border border-deadlock-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs font-semibold text-deadlock-muted whitespace-nowrap">
            Log Path:
          </span>
          <input
            type="text"
            value={logPath}
            onChange={(e) => {
              setLogPath(e.target.value);
              localStorage.setItem('deadlock_custom_log_path', e.target.value);
            }}
            placeholder="C:\...\Deadlock\game\citadel\console.log"
            className="flex-1 bg-deadlock-dark border border-deadlock-border rounded-lg px-3 py-1.5 text-xs text-deadlock-steam font-mono focus:outline-none focus:border-deadlock-accent"
          />
          <button
            type="button"
            onClick={handleDetectClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-deadlock-dark hover:bg-deadlock-border/40 border border-deadlock-border rounded-lg text-xs font-semibold text-gray-200 transition-colors shrink-0"
            title="Auto-scan drives for Deadlock console.log"
          >
            <FolderSearch className="w-3.5 h-3.5 text-deadlock-accent" />
            <span className="hidden sm:inline">Auto-Detect</span>
          </button>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {/* Status badge */}
          <div className="flex items-center gap-1.5 text-xs text-deadlock-muted px-2 py-1 bg-deadlock-dark rounded border border-deadlock-border">
            {isPathValid ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="max-w-[180px] sm:max-w-xs truncate">{statusMessage}</span>
          </div>

          {/* Pause / Resume */}
          <button
            type="button"
            onClick={() => setIsWatching(!isWatching)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              isWatching
                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {isWatching ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isWatching ? 'Pause' : 'Resume'}</span>
          </button>

          {/* Refresh now */}
          <button
            type="button"
            onClick={fetchLogs}
            className="p-1.5 bg-deadlock-dark hover:bg-deadlock-border/40 border border-deadlock-border rounded-lg text-gray-200 transition-colors"
            title="Poll now"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Toolbar (Filter & Action buttons) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-deadlock-dark/80 border border-deadlock-border/80 px-4 py-2.5 rounded-t-xl steam-card">
        {/* Filter categories & search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-deadlock-muted" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search console..."
              className="bg-black/50 border border-deadlock-border rounded-md pl-8 pr-3 py-1 text-xs text-deadlock-steam font-mono w-44 focus:outline-none focus:border-deadlock-accent"
            />
          </div>

          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-md border border-deadlock-border/50 text-xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                filterType === 'all' ? 'bg-deadlock-accent text-deadlock-steam font-bold' : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterType('match_found')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                filterType === 'match_found'
                  ? 'bg-deadlock-archmother text-deadlock-steam font-bold'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
            >
              Match
            </button>
            <button
              type="button"
              onClick={() => setFilterType('hero_detected')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                filterType === 'hero_detected'
                  ? 'bg-deadlock-hidden-king text-deadlock-steam font-bold'
                  : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
            >
              Hero/Player
            </button>
            <button
              type="button"
              onClick={() => setFilterType('info')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                filterType === 'info' ? 'bg-gray-700 text-deadlock-accent font-bold' : 'text-deadlock-muted hover:text-deadlock-steam'
              }`}
            >
              Info
            </button>
          </div>
        </div>

        {/* Output buttons */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-deadlock-muted cursor-pointer select-none mr-2">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-deadlock-dark border-deadlock-border text-deadlock-accent focus:ring-0"
            />
            <span>Auto-scroll</span>
          </label>

          <button
            type="button"
            onClick={handleCopyAll}
            className="flex items-center gap-1 px-2.5 py-1 bg-black/40 hover:bg-black/80 border border-deadlock-border rounded text-xs text-gray-300 font-medium transition-colors"
            title="Copy all lines to clipboard"
          >
            <Copy className="w-3 h-3 text-deadlock-accent" />
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportToFile}
            className="flex items-center gap-1 px-2.5 py-1 bg-black/40 hover:bg-black/80 border border-deadlock-border rounded text-xs text-gray-300 font-medium transition-colors"
            title="Save debug logs to deadlock_debug_log.txt"
          >
            <Download className="w-3 h-3 text-deadlock-win" />
            <span>{savedSuccess ? 'Saved!' : 'Save to File'}</span>
          </button>

          <button
            type="button"
            onClick={() => setEvents([])}
            className="p-1 bg-black/40 hover:bg-rose-950/40 border border-deadlock-border rounded text-deadlock-muted hover:text-rose-400 transition-colors"
            title="Clear view"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Screen */}
      <div className="bg-[#0c0a08] border-x border-b border-deadlock-border rounded-b-xl p-4 font-mono text-xs overflow-y-auto h-[480px] shadow-inner flex flex-col select-text">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-deadlock-muted gap-2">
            <Terminal className="w-8 h-8 opacity-40" />
            <p className="text-sm">No log lines matching criteria.</p>
            <p className="text-[11px] opacity-70">
              Start Deadlock with <code className="text-deadlock-accent">-condebug</code> to begin streaming logs.
            </p>
          </div>
        ) : (
          filteredEvents.map((evt, idx) => {
            const isMatch = evt.eventType === 'match_found';
            const isHero = evt.eventType === 'hero_detected';

            return (
              <div
                key={idx}
                className={`py-0.5 px-1 rounded flex items-start gap-2 leading-relaxed transition-colors hover:bg-white/5 ${
                  isMatch
                    ? 'bg-deadlock-archmother/10 text-deadlock-archmother font-bold'
                    : isHero
                    ? 'bg-deadlock-hidden-king/10 text-deadlock-hidden-king font-semibold'
                    : 'text-gray-300'
                }`}
              >
                <span className="text-deadlock-muted select-none opacity-50 shrink-0 text-[10px]">
                  {String(idx + 1).padStart(3, '0')}
                </span>
                <span className="text-deadlock-muted select-none shrink-0 text-[11px]">
                  [{evt.timestamp}]
                </span>
                {isMatch && (
                  <span className="px-1 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-deadlock-archmother text-deadlock-steam shrink-0">
                    MATCH
                  </span>
                )}
                {isHero && (
                  <span className="px-1 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-deadlock-hidden-king text-deadlock-steam shrink-0">
                    HERO
                  </span>
                )}
                <span className="break-all whitespace-pre-wrap">{evt.rawLine}</span>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
