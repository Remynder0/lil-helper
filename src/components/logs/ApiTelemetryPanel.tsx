import React, { useState } from 'react';
import { Globe, Trash2, Radio, ChevronDown } from 'lucide-react';
import { ApiLogEntry, clearApiLogs } from '../../services/api/apiLogger';
import { formatDurationDHM } from '../../services/logs/matchQueue';

interface ApiTelemetryPanelProps {
  apiLogs: ApiLogEntry[];
}

export const ApiTelemetryPanel: React.FC<ApiTelemetryPanelProps> = ({ apiLogs }) => {
  const [expandedApiLogId, setExpandedApiLogId] = useState<string | null>(null);

  return (
    <div className="steam-glass steam-panel rounded-xl p-5 border border-deadlock-border/80 shadow-lg flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-deadlock-border/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-deadlock-dark border border-deadlock-border/60 text-deadlock-accent">
            <Globe className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-deadlock-steam">
              Dernières Requêtes vers l&apos;API ({apiLogs.length}/10)
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
            Click &quot;Ping Rank API&quot; or sync matches to see live requests appear here.
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

                    <span
                      className="font-mono text-gray-300 truncate text-[11px]"
                      title={req.endpoint}
                    >
                      {req.endpoint}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-mono text-deadlock-accent">
                      {req.durationMs}ms
                    </span>
                    <span
                      className="text-[10px] font-mono text-deadlock-muted"
                      title={req.timestamp}
                    >
                      il y a {formatDurationDHM(req.timeMs)}
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
                      <span
                        className={req.success ? 'text-emerald-300' : 'text-rose-300 font-bold'}
                      >
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
  );
};
