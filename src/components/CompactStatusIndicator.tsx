import React, { useState } from 'react';

interface CompactStatusIndicatorProps {
  firestoreStatus?: 'connected' | 'connecting' | 'offline';
  isCloudSyncing?: boolean;
}

export const CompactStatusIndicator: React.FC<CompactStatusIndicatorProps> = ({
  firestoreStatus = 'connected',
  isCloudSyncing = true,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const isConnected = firestoreStatus === 'connected';
  const isConnecting = firestoreStatus === 'connecting';
  const isOffline = firestoreStatus === 'offline';

  return (
    <div
      className="relative inline-flex items-center justify-center cursor-pointer select-none"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => setShowTooltip(prev => !prev)}
      role="button"
      tabIndex={0}
      aria-label="Cloud and Database Connection Status"
    >
      {/* Outer Ring & Inner Dot Container */}
      <div className="relative w-7 h-7 flex items-center justify-center">
        {/* Outer Ring representing Firestore Live database connection */}
        <span
          className={`absolute inset-0 rounded-full border-2 transition-all duration-700 ${
            isConnected
              ? 'border-[#4BA95F]/70 dark:border-[#4BA95F]/80 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] opacity-60'
              : isConnecting
              ? 'border-[#FEA339] animate-spin border-t-transparent'
              : 'border-rose-500/70 dark:border-rose-500/80'
          }`}
        />
        <span
          className={`absolute inset-0.5 rounded-full border-[1.5px] transition-all duration-500 ${
            isConnected
              ? 'border-[#4BA95F] dark:border-[#5ec574]'
              : isConnecting
              ? 'border-[#FEA339]/50'
              : 'border-rose-500'
          }`}
        />

        {/* Inner Dot representing Live Cloud Sync status */}
        <span
          className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
            isConnected && isCloudSyncing
              ? 'bg-[#4BA95F] shadow-[0_0_8px_rgba(75,169,95,0.75)] animate-pulse'
              : isConnecting
              ? 'bg-[#FEA339] shadow-[0_0_8px_rgba(254,163,57,0.75)] animate-bounce'
              : 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.75)]'
          }`}
        />
      </div>

      {/* Floating Tooltip */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 w-56 p-3 rounded-2xl bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#2a2a2a] shadow-xl text-xs z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-[#222222]">
            <span className="font-bold text-slate-900 dark:text-white">Connection Health</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                isConnected
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : isConnecting
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
              }`}
            >
              {firestoreStatus}
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4BA95F] inline-block" />
                Firestore Database
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {isConnected ? 'Online (Real-time)' : isConnecting ? 'Connecting…' : 'Offline'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#77DDFA] inline-block" />
                Cloud Sync Stream
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {isCloudSyncing ? 'Active' : 'Paused'}
              </span>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-[#222222] text-[10px] text-slate-400 dark:text-slate-500 text-center">
            Inner dot: Cloud Sync &bull; Outer ring: Firestore Live
          </div>
        </div>
      )}
    </div>
  );
};
