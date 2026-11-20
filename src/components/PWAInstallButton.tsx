import { Download, Smartphone, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton({ onAfterAction }: { onAfterAction?: () => void }) {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const navigate = useNavigate();

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          onAfterAction?.();
          void install();
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-400/50 bg-teal-400/15 px-3 py-1.5 text-xs font-semibold text-teal-200 transition-colors hover:bg-teal-400/25 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="h-3.5 w-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onAfterAction?.();
        navigate('/mobile-app');
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-teal-700/80 bg-[#032423] px-3 py-1.5 text-xs font-medium text-teal-200 transition-colors hover:border-teal-400 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
    >
      <Smartphone className="h-3.5 w-3.5" />
      <span>Install App</span>
    </button>
  );
}

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-400/50 bg-[#032423] px-3.5 py-2 text-xs font-medium text-amber-300 shadow-xl md:bottom-4">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Offline Mode — Displaying cached telemetry</span>
    </div>
  );
}
