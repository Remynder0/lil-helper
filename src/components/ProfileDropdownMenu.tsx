import React, { useState, useEffect, useRef } from 'react';
import { ConnectedProfile } from '../types/match';
import { useUIStore } from '../stores/useUIStore';
import {
  Activity,
  Download,
  Upload,
  RefreshCw,
  Terminal,
  ChevronDown,
  LogOut,
  FolderSync,
  Search,
  Cloud,
} from 'lucide-react';
import { syncMatchesWithCloud } from '../services/storage';
import { useToast } from './Toast';
import { useMatchStore } from '../stores/useMatchStore';

interface ProfileDropdownMenuProps {
  profile: ConnectedProfile;
  isSyncing: boolean;
  cooldownRemaining: number;
  onSync: () => void;
  onExport: () => void;
  onTriggerImportFile: () => void;
  onDisconnect: () => void;
}

export const ProfileDropdownMenu: React.FC<ProfileDropdownMenuProps> = ({
  profile,
  isSyncing,
  cooldownRemaining,
  onSync,
  onExport,
  onTriggerImportFile,
  onDisconnect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const setImportByIdModalOpen = useUIStore((s) => s.setImportByIdModalOpen);
  const setProfileModalOpen = useUIStore((s) => s.setProfileModalOpen);
  const toast = useToast();

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="flex items-center gap-2 bg-deadlock-dark p-1 rounded-lg border border-deadlock-border relative">
      {/* Profile Pill Dropdown Trigger */}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-deadlock-panel transition-colors text-left"
          title="Profile & Options Menu"
        >
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.personaName}
              className="w-5 h-5 rounded-full object-cover border border-deadlock-border shrink-0"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-deadlock-panel border border-deadlock-border flex items-center justify-center text-deadlock-accent text-[10px] shrink-0 font-black">
              {profile.personaName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-xs font-bold text-gray-200 max-w-[90px] truncate hidden sm:inline">
            {profile.personaName}
          </span>
          <ChevronDown className={`w-3 h-3 text-deadlock-muted transition-transform ${isOpen ? 'rotate-180 text-deadlock-steam' : ''}`} />
        </button>

        {/* Profile Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-deadlock-panel steam-card border border-deadlock-border shadow-2xl py-1.5 z-50 flex flex-col text-xs animate-fadeIn">
            {/* Header in dropdown */}
            <div className="px-3 py-2 border-b border-deadlock-border/60 flex flex-col">
              <span className="text-[11px] font-bold text-deadlock-steam truncate">
                {profile.personaName}
              </span>
              <span className="text-[10px] text-deadlock-muted font-mono">
                ID: {profile.accountId}
              </span>
            </div>

            {/* Log Dashboard Option */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('logs');
                setIsOpen(false);
              }}
              className="flex items-center gap-2.5 px-3 py-2 text-gray-200 hover:bg-deadlock-card/60 hover:text-deadlock-steam transition-colors text-left"
            >
              <Activity className="w-4 h-4 text-deadlock-accent shrink-0" />
              <span>Log Dashboard</span>
            </button>

            {/* Import Match by ID */}
            <button
              type="button"
              onClick={() => {
                setImportByIdModalOpen(true);
                setIsOpen(false);
              }}
              className="flex items-center gap-2.5 px-3 py-2 text-gray-200 hover:bg-deadlock-card/60 hover:text-deadlock-steam transition-colors text-left"
            >
              <Search className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Import Match by ID</span>
            </button>

            {/* Debug Console Option */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('logs');
                setIsOpen(false);
              }}
              className="flex items-center gap-2.5 px-3 py-2 text-gray-200 hover:bg-deadlock-card/60 hover:text-deadlock-steam transition-colors text-left"
            >
              <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Debug Console</span>
            </button>

            {/* Switch Account */}
            <button
              type="button"
              onClick={() => {
                setProfileModalOpen(true);
                setIsOpen(false);
              }}
              className="flex items-center gap-2.5 px-3 py-2 text-gray-200 hover:bg-deadlock-card/60 hover:text-deadlock-steam transition-colors text-left"
            >
              <FolderSync className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Switch Profile</span>
            </button>

            {/* Sync to Supabase Cloud */}
            <button
              type="button"
              onClick={async () => {
                setIsOpen(false);
                try {
                  const res = await syncMatchesWithCloud(profile.accountId, profile);
                  if (res.success) {
                    toast.success(res.message);
                    await useMatchStore.getState().loadMatches(profile.accountId);
                  } else {
                    toast.error(res.message);
                  }
                } catch (err: any) {
                  toast.error(err?.message || 'Cloud Sync failed');
                }
              }}
              className="flex items-center gap-2.5 px-3 py-2 text-gray-200 hover:bg-deadlock-card/60 hover:text-[#3ecf8e] transition-colors text-left"
            >
              <Cloud className="w-4 h-4 text-[#3ecf8e] shrink-0" />
              <span>Sync with Supabase Cloud</span>
            </button>

            <div className="h-px bg-deadlock-border/60 my-1" />

            {/* Export Matches */}
            <button
              type="button"
              onClick={() => {
                onExport();
                setIsOpen(false);
              }}
              className="flex items-center gap-2.5 px-3 py-2 text-gray-200 hover:bg-deadlock-card/60 hover:text-deadlock-steam transition-colors text-left"
            >
              <Download className="w-4 h-4 text-deadlock-hidden-king shrink-0" />
              <span>Export Matches (JSON)</span>
            </button>

            {/* Import Matches */}
            <button
              type="button"
              onClick={() => {
                onTriggerImportFile();
                setIsOpen(false);
              }}
              className="flex items-center gap-2.5 px-3 py-2 text-gray-200 hover:bg-deadlock-card/60 hover:text-deadlock-steam transition-colors text-left"
            >
              <Upload className="w-4 h-4 text-deadlock-archmother shrink-0" />
              <span>Import Matches (JSON)</span>
            </button>

            <div className="h-px bg-deadlock-border/60 my-1" />

            {/* Disconnect Profile */}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Disconnect your profile? Existing saved matches will remain stored locally.')) {
                  onDisconnect();
                  setIsOpen(false);
                }
              }}
              className="flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors text-left"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>

      {/* Manual Sync / Refresh Button with 2-min cooldown */}
      <button
        type="button"
        onClick={onSync}
        disabled={isSyncing || cooldownRemaining > 0}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-all ${
          isSyncing
            ? 'bg-deadlock-accent/20 text-deadlock-accent cursor-not-allowed'
            : cooldownRemaining > 0
            ? 'bg-deadlock-border/40 text-deadlock-muted border border-deadlock-border/60 cursor-not-allowed'
            : 'bg-deadlock-accent text-deadlock-steam hover:text-black hover:bg-yellow-400 shadow-sm'
        }`}
        title={
          cooldownRemaining > 0
            ? `Please wait ${Math.floor(cooldownRemaining / 60)}m ${cooldownRemaining % 60}s before refreshing again to prevent API rate limits.`
            : 'Refresh & sync new ranked matches from Deadlock API'
        }
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        <span className="hidden md:inline">
          {isSyncing
            ? 'Syncing...'
            : cooldownRemaining > 0
            ? `Refresh (${Math.floor(cooldownRemaining / 60)}:${String(cooldownRemaining % 60).padStart(2, '0')})`
            : 'Refresh'}
        </span>
      </button>
    </div>
  );
};
