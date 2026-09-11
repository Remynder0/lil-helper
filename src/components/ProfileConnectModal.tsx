import React, { useState } from 'react';
import { ConnectedProfile } from '../types/match';
import { searchSteamProfiles, SteamProfileSearchResult } from '../services/deadlockApi';
import { Search, User, Check, X, Loader2, ExternalLink } from 'lucide-react';

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

  if (!isOpen) return null;

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
    } catch (err) {
      console.error('Search failed:', err);
      setErrorMessage('Failed to search Steam profiles. Please try again.');
    } finally {
      setIsSearching(false);
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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-deadlock-panel border border-deadlock-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
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
            onClick={onClose}
            className="p-1.5 rounded-lg text-deadlock-muted hover:text-white hover:bg-deadlock-dark transition-colors"
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
                    <span className="font-black text-sm text-white">
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
                    className="text-[10px] text-deadlock-muted hover:text-white flex items-center gap-1"
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
                  className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 rounded bg-red-950/30 border border-red-900/40 hover:bg-red-950/50 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-300">
              {currentProfile ? 'Switch to another account' : 'Search by Steam Nickname or Account ID'}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-deadlock-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Mika or 202670018..."
                  className="w-full bg-deadlock-dark border border-deadlock-border rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-deadlock-muted focus:outline-none focus:border-deadlock-accent transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-4 py-2.5 rounded-xl bg-deadlock-accent text-black font-bold text-xs hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all shadow-md shrink-0"
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
          </form>

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-800/50 text-red-400 text-xs">
              {errorMessage}
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
                  No Steam accounts matched your query. Make sure the nickname is spelled correctly or enter your numeric SteamID3 / Account ID directly.
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
                            <div className="text-xs font-bold text-white truncate">
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shrink-0 ${
                            isSelected
                              ? 'bg-deadlock-accent text-black shadow-sm'
                              : 'bg-deadlock-panel hover:bg-deadlock-border text-gray-200 border border-deadlock-border'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Connected</span>
                            </>
                          ) : (
                            <span>Select</span>
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
