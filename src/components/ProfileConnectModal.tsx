import React, { useState, useRef, useEffect } from 'react';
import { ConnectedProfile } from '../types/match';
import { searchSteamProfiles, SteamProfileSearchResult } from '../services/deadlockApi';
import { isTauriEnvironment, syncMatchesWithCloud } from '../services/storage';
import { getCloudSyncState, subscribeToCloudSync, CloudSyncState } from '../services/cloudSync';
import steamLogo from '../assets/steam-logo.svg';
import { Search, User, Check, X, Loader2, Cloud, ExternalLink } from 'lucide-react';

interface ProfileConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: ConnectedProfile | null;
  onConnect: (profile: ConnectedProfile) => void;
  onDisconnect: () => void;
}

export const ProfileConnectModal: React.FC<ProfileConnectModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onConnect,
  onDisconnect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SteamProfileSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWaitingForSteam, setIsWaitingForSteam] = useState(false);
  const [cloudState, setCloudState] = useState<CloudSyncState>(getCloudSyncState());
  const [isCloudSyncingManual, setIsCloudSyncingManual] = useState(false);
  const [cloudSyncMessage, setCloudSyncMessage] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const unsub = subscribeToCloudSync((state) => {
      setCloudState(state);
    });
    return () => unsub();
  }, []);

  const clearSteamPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsWaitingForSteam(false);
  };

  useEffect(() => {
    return () => {
      clearSteamPolling();
    };
  }, []);

  if (!isOpen) return null;

  const handleClose = () => {
    clearSteamPolling();
    onClose();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setErrorMessage(null);
    try {
      const results = await searchSteamProfiles(query);
      setSearchResults(results);
      setHasSearched(true);
      if (results.length === 0) {
        setErrorMessage('No Steam accounts matched your query. Please verify the nickname or numeric ID.');
      }
    } catch (err: any) {
      console.error('Search failed:', err);
      if (err?.message === 'STEAM_SEARCH_503' || err?.status === 503) {
        setErrorMessage(
          "Deadlock API's nickname search index is temporarily in maintenance (503 Service Unavailable). You can connect immediately by entering your numeric Steam Friend Code (e.g. 123456789), SteamID64, or Steam profile URL."
        );
      } else {
        setErrorMessage('Failed to search Steam profiles. Please check your query or try again.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSteamLogin = async () => {
    if (isTauriEnvironment()) {
      clearSteamPolling();
      setIsWaitingForSteam(true);
      const authUrl = 'http://localhost:1420/api/auth/steam/login?source=desktop';
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(authUrl);
      } catch (err) {
        console.warn('Tauri openUrl failed, falling back to window.open:', err);
        window.open(authUrl, '_blank');
      }

      // Poll local session endpoint for up to 2 minutes
      const startTime = Date.now();
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:1420/api/auth/steam/session');
          if (res.ok) {
            const data = await res.json();
            if (data.session && data.session.timestamp >= startTime) {
              clearSteamPolling();
              const connected: ConnectedProfile = {
                accountId: data.session.account_id,
                personaName: data.session.persona_name,
                avatarUrl: data.session.avatar_url,
                profileUrl: data.session.profile_url,
                lastSyncedAt: new Date().toISOString(),
              };
              onConnect(connected);
              onClose();
            }
          }
        } catch {}

        if (Date.now() - startTime > 120000) {
          clearSteamPolling();
        }
      }, 1000);
    } else {
      window.location.href = `/api/auth/steam/login?return_to=${encodeURIComponent(window.location.pathname)}`;
    }
  };

  const handleSelectProfile = (profile: SteamProfileSearchResult) => {
    const connected: ConnectedProfile = {
      accountId: profile.account_id,
      personaName: profile.personaname,
      avatarUrl: profile.avatar,
      profileUrl: profile.profileurl,
      lastSyncedAt: new Date().toISOString(),
    };
    onConnect(connected);
    handleClose();
  };

  const handleManualCloudSync = async () => {
    if (!currentProfile || isCloudSyncingManual) return;
    setIsCloudSyncingManual(true);
    setCloudSyncMessage(null);
    try {
      const res = await syncMatchesWithCloud(currentProfile.accountId, currentProfile);
      setCloudSyncMessage(res.message);
    } catch (err: any) {
      setCloudSyncMessage(err?.message || 'Cloud sync failed.');
    } finally {
      setIsCloudSyncingManual(false);
      setTimeout(() => setCloudSyncMessage(null), 5000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fadeIn">
      <div className="liquid-glass-modal steam-panel rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-deadlock-border/80 flex items-center justify-between bg-deadlock-dark/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-deadlock-accent/20 border border-deadlock-accent/40 flex items-center justify-center text-deadlock-accent">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-100">
                {currentProfile ? 'Connected Steam Profile' : 'Connect Steam Profile'}
              </h2>
              <p className="text-[11px] text-deadlock-muted">
                Auto-import your official Ranked match history
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-deadlock-muted hover:text-deadlock-steam hover:bg-deadlock-dark transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Active Connected Profile Card */}
          {currentProfile && (
            <div className="p-3.5 rounded-xl bg-deadlock-dark/90 border border-deadlock-accent/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {currentProfile.avatarUrl ? (
                  <img
                    src={currentProfile.avatarUrl}
                    alt={currentProfile.personaName}
                    className="w-11 h-11 rounded-lg border border-deadlock-border object-cover shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-deadlock-panel border border-deadlock-border flex items-center justify-center text-gray-400 shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-deadlock-steam">
                      {currentProfile.personaName}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-deadlock-win/20 text-deadlock-win border border-deadlock-win/40">
                      Connected
                    </span>
                  </div>
                  <div className="text-[11px] text-deadlock-muted font-mono mt-0.5">
                    Account ID: {currentProfile.accountId}
                  </div>
                  {currentProfile.lastSyncedAt && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Last sync: {new Date(currentProfile.lastSyncedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {currentProfile.profileUrl && (
                  <a
                    href={currentProfile.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-deadlock-muted hover:text-deadlock-steam flex items-center gap-1"
                  >
                    <span>Steam</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Disconnect your profile? Existing local matches will remain saved.')) {
                      onDisconnect();
                    }
                  }}
                  className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 rounded bg-red-950/30 border border-red-900/40 hover:bg-red-950/50 transition-colors cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {/* Supabase Cloud Sync Status Card */}
          <div className="p-3 rounded-xl bg-deadlock-dark/75 border border-deadlock-border/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#3ecf8e]/15 border border-[#3ecf8e]/35 flex items-center justify-center text-[#3ecf8e] shrink-0">
                <Cloud className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-200">Supabase Cloud</span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                      cloudState.isConfigured
                        ? 'bg-[#3ecf8e]/20 text-[#3ecf8e] border-[#3ecf8e]/40'
                        : 'bg-gray-800 text-gray-400 border-gray-700'
                    }`}
                  >
                    {cloudState.isConfigured ? 'Synced / Active' : 'Offline / Unconfigured'}
                  </span>
                </div>
                <div className="text-[10px] text-deadlock-muted truncate mt-0.5">
                  {cloudSyncMessage ? (
                    <span className="text-deadlock-accent font-medium">{cloudSyncMessage}</span>
                  ) : cloudState.lastSyncedAt ? (
                    `Last synced: ${new Date(cloudState.lastSyncedAt).toLocaleTimeString()}`
                  ) : cloudState.isConfigured ? (
                    'Ready — match history auto-syncs with cloud database'
                  ) : (
                    'Configure credentials in .env to enable multi-device sync'
                  )}
                </div>
              </div>
            </div>

            {currentProfile && (
              <button
                type="button"
                onClick={handleManualCloudSync}
                disabled={isCloudSyncingManual || cloudState.isSyncing}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-deadlock-dark border border-deadlock-border hover:border-[#3ecf8e] hover:text-[#3ecf8e] text-gray-200 shrink-0 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                title="Force synchronize local match history with Supabase Cloud"
              >
                {isCloudSyncingManual || cloudState.isSyncing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3ecf8e]" />
                    <span className="text-[11px]">Syncing...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-[#3ecf8e]" />
                    <span className="text-[11px]">Sync Cloud</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Steam Login Button: Logo + "connect ?" */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSteamLogin}
              disabled={isWaitingForSteam}
              className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 border ${
                isWaitingForSteam
                  ? 'bg-[#1b2838] opacity-80 cursor-wait border-[#66c0f4]/50 shadow-[0_0_15px_rgba(102,192,244,0.3)]'
                  : 'bg-[#171a21] hover:bg-[#1b2838] border-gray-700/80 hover:border-[#66c0f4]/60 hover:shadow-[0_0_15px_rgba(102,192,244,0.3)] cursor-pointer'
              }`}
            >
              <img src={steamLogo} alt="Steam" className="w-5 h-5 shrink-0 drop-shadow-md" />
              <span className="text-xs font-bold text-gray-200 hover:text-white transition-colors tracking-wide">
                {isWaitingForSteam ? 'connecting...' : 'connect ?'}
              </span>
              {isWaitingForSteam && <Loader2 className="w-3.5 h-3.5 text-[#66c0f4] animate-spin shrink-0" />}
            </button>

            {/* Waiting for Steam Banner with Cancel Button */}
            {isWaitingForSteam && (
              <div className="p-3 rounded-xl bg-[#172433] border border-[#66c0f4]/50 flex items-center justify-between gap-3 animate-fadeIn shadow-lg">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Loader2 className="w-4 h-4 text-[#66c0f4] animate-spin shrink-0" />
                  <div className="text-xs text-gray-200 min-w-0">
                    <p className="font-semibold text-[#66c0f4]">Browser tab opened for Steam login</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      Complete sign-in on Steam to connect automatically.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearSteamPolling}
                  className="px-2.5 py-1 text-xs text-gray-300 hover:text-white bg-black/40 hover:bg-black/60 border border-gray-600 rounded-lg shrink-0 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-0.5">
            <div className="flex-1 h-px bg-deadlock-border/60" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-deadlock-muted">
              or search by nickname or steam id
            </span>
            <div className="flex-1 h-px bg-deadlock-border/60" />
          </div>

          {/* Classic Search Form */}
          <form onSubmit={handleSearch} className="flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-deadlock-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter nickname, Friend Code (e.g. 123456789), or SteamID64..."
                  className="w-full bg-deadlock-card border border-deadlock-border rounded-xl pl-9 pr-4 py-2.5 text-xs text-deadlock-steam placeholder-deadlock-muted focus:outline-none focus:border-deadlock-accent transition-colors font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-4 py-2.5 rounded-xl bg-deadlock-accent text-deadlock-dark hover:bg-deadlock-brass font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <span>Search</span>
                )}
              </button>
            </div>
            <p className="text-[11px] text-deadlock-muted leading-relaxed">
              <span className="text-deadlock-accent font-semibold">💡 Tip:</span> Enter any <strong className="text-gray-200">Steam nickname</strong>, numeric <strong className="text-gray-200">Friend Code</strong>, <strong className="text-gray-200">SteamID64</strong>, or profile URL.
            </p>
          </form>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/50 text-amber-200 text-xs flex flex-col gap-1 leading-relaxed">
              <span className="font-bold text-amber-400">⚠️ Search Information</span>
              <p>{errorMessage}</p>
            </div>
          )}

          {/* Search Results */}
          {hasSearched && (
            <div className="flex flex-col gap-2 mt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-deadlock-muted">
                {searchResults.length > 0 ? `Results (${searchResults.length})` : 'No results found'}
              </span>

              {searchResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-deadlock-muted border border-deadlock-border/40 rounded-xl bg-deadlock-dark/40">
                  No Steam accounts matched your query. Make sure the nickname is spelled correctly or enter your numeric Friend Code / Account ID directly.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1">
                  {searchResults.map((result) => {
                    const isSelected = currentProfile?.accountId === result.account_id;
                    return (
                      <div
                        key={result.account_id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-deadlock-accent/15 border-deadlock-accent'
                            : 'bg-deadlock-dark/80 border-deadlock-border hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {result.avatar ? (
                            <img
                              src={result.avatar}
                              alt={result.personaname}
                              className="w-9 h-9 rounded-lg object-cover border border-deadlock-border shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-deadlock-panel border border-deadlock-border flex items-center justify-center text-gray-400 shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-deadlock-steam truncate">
                              {result.personaname}
                            </div>
                            <div className="text-[10px] text-deadlock-muted font-mono">
                              ID: {result.account_id}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectProfile(result)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-deadlock-accent text-black shadow-sm'
                              : 'bg-deadlock-accent/90 hover:bg-deadlock-brass text-black border border-deadlock-accent shadow-sm'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Connected</span>
                            </>
                          ) : (
                            <span>Connect</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
