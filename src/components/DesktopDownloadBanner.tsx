import React, { useState } from 'react';
import { Download, Monitor, X, ExternalLink, Sparkles } from 'lucide-react';
import { isTauriEnvironment } from '../services/storage';

export const DesktopDownloadBanner: React.FC = () => {
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('deadlock_desktop_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  // Only display banner on Web browsers (outside Tauri)
  if (isTauriEnvironment() || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('deadlock_desktop_banner_dismissed', 'true');
    } catch {}
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-deadlock-accent/50 bg-gradient-to-r from-deadlock-panel/95 via-[#1b232e]/90 to-deadlock-panel/95 shadow-xl p-4 sm:p-5 text-deadlock-steam animate-fadeIn">
      {/* Subtle occult/steampunk top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-deadlock-accent to-transparent" />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-deadlock-accent/20 border border-deadlock-accent/40 flex items-center justify-center text-deadlock-accent shrink-0 shadow-inner">
            <Monitor className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-white tracking-wide">
                Playing Deadlock? Download the Windows Desktop App!
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-deadlock-accent/20 text-deadlock-accent border border-deadlock-accent/40 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Recommended</span>
              </span>
            </div>
            <p className="text-xs text-deadlock-muted mt-1 leading-relaxed">
              Live in-game detection, screen OCR draft assistant, and automatic <code className="text-deadlock-steam font-mono">.dem</code> replay parsing in the background.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
          <a
            href="https://github.com/Remynder0/deadlock-analyse/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-deadlock-accent text-deadlock-dark hover:bg-deadlock-brass font-black text-xs flex items-center gap-2 transition-all shadow-lg hover:shadow-deadlock-accent/30 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download (.exe / .msi)</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="p-2 rounded-lg text-deadlock-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
