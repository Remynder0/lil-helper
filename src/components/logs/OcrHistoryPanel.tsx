import React from 'react';
import { Eye, Trash2, ExternalLink } from 'lucide-react';
import { OcrCaptureEntry, clearOcrCaptures } from '../../services/ocr/ocrHistory';
import { formatDurationDHM } from '../../services/logs/matchQueue';
import { HeroAvatar } from '../HeroAvatar';
import { SIDE_LABELS } from '../../types/match';

interface OcrHistoryPanelProps {
  ocrCaptures: OcrCaptureEntry[];
  onInspectCapture: (entry: OcrCaptureEntry) => void;
}

export const OcrHistoryPanel: React.FC<OcrHistoryPanelProps> = ({
  ocrCaptures,
  onInspectCapture,
}) => {
  return (
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
              Escape menu team draft scans &amp; text extraction history
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
            Use &quot;Run Test OCR&quot; above or use the Occult Eye button in the Draft Assistant
            to scan the Escape menu.
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
                    il y a {formatDurationDHM(capture.timeMs)}
                  </span>
                  <span className="text-[10px] font-mono text-deadlock-muted">
                    ({capture.timestamp})
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
                  onClick={() => onInspectCapture(capture)}
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
  );
};
