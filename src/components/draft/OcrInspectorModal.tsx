import React from 'react';
import { Terminal, Eye, X } from 'lucide-react';
import { ScreenScanResult } from '../../services/screenOcr';

interface OcrInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastScanResult: ScreenScanResult | null;
}

export const OcrInspectorModal: React.FC<OcrInspectorModalProps> = ({
  isOpen,
  onClose,
  lastScanResult,
}) => {
  if (!isOpen || !lastScanResult) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-deadlock-panel border border-deadlock-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-deadlock-border bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>OCR Diagnostic Log</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                  {lastScanResult.allies.length} Allies / {lastScanResult.enemies.length} Enemies
                </span>
              </h3>
              <p className="text-xs text-deadlock-muted">
                Inspect the captured game panel and raw text extracted by the OCR engine
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Event Logs */}
          <div>
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Execution Log</span>
            </h4>
            <div className="bg-black/60 border border-deadlock-border/80 rounded-lg p-3 font-mono text-xs text-gray-300 space-y-1">
              {lastScanResult.statusLog.map((log, idx) => (
                <div key={idx} className="leading-relaxed">
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Two Column Layout: Captured Image & Detected Text */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: What the screen capture saw */}
            <div>
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-purple-400" />
                <span>Captured Image (Preprocessed)</span>
              </h4>
              <div className="border border-deadlock-border/80 rounded-lg overflow-hidden bg-black/50 p-2 max-h-80 overflow-y-auto">
                {lastScanResult.capturedImage ? (
                  <img
                    src={lastScanResult.capturedImage}
                    alt="Captured screen portion"
                    className="w-full h-auto rounded border border-white/5 object-contain"
                  />
                ) : (
                  <div className="text-center py-10 text-xs text-gray-500">
                    No image available
                  </div>
                )}
              </div>
              <p className="text-[11px] text-deadlock-muted mt-1.5 italic">
                If this image does not display the Deadlock Escape menu, ensure the game is visible on screen when clicking scan.
              </p>
            </div>

            {/* Right: Raw OCR lines and matched words */}
            <div className="flex flex-col gap-4">
              <div>
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  Recognized Heroes
                </h4>
                <div className="bg-black/40 border border-deadlock-border/80 rounded-lg p-3">
                  {lastScanResult.matchedWords.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {lastScanResult.matchedWords.map((m, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 rounded bg-emerald-950/60 border border-emerald-500/40 text-[11px] text-emerald-300 font-mono"
                        >
                          "{m.word}" &rarr; <strong>{m.matchedHero.name}</strong> (dist: {m.distance})
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-amber-400">
                      ⚠️ No matching hero names found in raw text.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  Raw Text Extracted by OCR ({lastScanResult.lines.length} lines)
                </h4>
                <div className="bg-black/60 border border-deadlock-border/80 rounded-lg p-3 font-mono text-[11px] text-gray-400 max-h-48 overflow-y-auto space-y-0.5 whitespace-pre-wrap">
                  {lastScanResult.rawText || '(No text detected)'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-deadlock-border bg-black/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-deadlock-accent text-black font-bold text-xs hover:bg-yellow-400 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
