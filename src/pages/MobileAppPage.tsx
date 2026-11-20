import {
  CheckCircle2,
  Download,
  ExternalLink,
  Share,
  ShieldCheck,
  Smartphone,
  Terminal,
  Wifi,
} from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function MobileAppPage() {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, install } =
    usePWAInstall();
  const [installAttempted, setInstallAttempted] = useState(false);

  const handleAndroidInstall = async () => {
    setInstallAttempted(true);
    await install();
  };

  const detectedPlatform = isInstalled
    ? 'Installed Standalone App'
    : isIOS
    ? 'Apple iPhone / iPad (iOS)'
    : isAndroid
    ? 'Android Mobile'
    : 'Desktop / Web Browser';

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      {/* Header */}
      <header className="rounded-2xl border border-teal-800/70 bg-[#063836] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-md border border-teal-500/40 bg-[#032423] px-3 py-1 font-mono text-xs text-teal-300">
            <Smartphone className="h-3.5 w-3.5" />
            <span>{detectedPlatform}</span>
          </div>

          {isInstalled && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/50 bg-emerald-500/15 px-3 py-1 font-mono text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>App Mode Active</span>
            </span>
          )}
        </div>

        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          AI-EIA Screening Mobile App (Android &amp; Apple iOS)
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-teal-100/85">
          Install AI-EIA Screening directly onto your Android phone or Apple iPhone/iPad as a
          full-screen mobile app with Home Screen icon, bottom app tab navigation, and offline
          telemetry caching — no app store download required.
        </p>

        {isInIframe && (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-400/45 bg-[#032423] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-amber-200">
              You are currently viewing this inside an embedded preview frame. Browsers only allow
              mobile app installation when opened directly in Chrome (Android) or Safari (iOS) in
              a standalone tab.
            </p>
            {currentUrl && (
              <a
                href={currentUrl}
                target="_top"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-[#042f2e] hover:bg-amber-300 shrink-0 whitespace-nowrap self-start sm:self-center"
              >
                <span>Open Standalone Tab</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}
      </header>

      {/* Android & Apple iOS Install Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Android Card */}
        <section className="flex flex-col justify-between rounded-2xl border border-teal-700/70 bg-[#063836] p-6 space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-teal-800/60 pb-3">
              <div>
                <div className="font-mono text-xs font-bold text-emerald-300">ANDROID MOBILE</div>
                <h2 className="font-display text-xl font-bold text-white">
                  Chrome / Edge / Samsung Internet
                </h2>
              </div>
              <img
                src="/pwa-192x192.png"
                alt="AI-EIA Android app icon"
                className="h-12 w-12 rounded-xl border border-teal-600/60 shadow"
              />
            </div>

            {isInstallable ? (
              <div className="space-y-3 rounded-xl border border-emerald-400/40 bg-[#032423] p-4">
                <p className="text-xs text-emerald-200">
                  Ready for one-tap installation on this Android browser.
                </p>
                <button
                  type="button"
                  onClick={handleAndroidInstall}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-400 px-4 py-2.5 text-sm font-bold text-[#042f2e] hover:bg-teal-300 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Install Android App</span>
                </button>
                {installAttempted && (
                  <p className="text-[11px] text-teal-200/80">
                    If the prompt did not appear, use the 3-dot Chrome menu steps below.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-teal-800/70 bg-[#032423] p-4 text-xs text-teal-100/85">
                {isInstalled
                  ? 'AI-EIA Screening is already installed and running as a standalone Android app.'
                  : 'Follow the 3 steps below in Google Chrome on your Android phone:'}
              </div>
            )}

            <ol className="space-y-2.5 text-sm text-teal-50/90">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-400/20 font-mono text-xs font-bold text-teal-300">
                  1
                </span>
                <span>
                  Open your deployed site URL in <strong>Google Chrome</strong> on Android.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-400/20 font-mono text-xs font-bold text-teal-300">
                  2
                </span>
                <span>
                  Tap the <strong>⋮ Menu</strong> (top-right) and select{' '}
                  <strong>Add to Home screen</strong> → <strong>Install</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-400/20 font-mono text-xs font-bold text-teal-300">
                  3
                </span>
                <span>
                  Launch <strong>AI-EIA Screening</strong> from your Android Home Screen with
                  full-screen bottom tabs and offline caching.
                </span>
              </li>
            </ol>
          </div>
        </section>

        {/* Apple iOS Card */}
        <section className="flex flex-col justify-between rounded-2xl border border-teal-700/70 bg-[#063836] p-6 space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-teal-800/60 pb-3">
              <div>
                <div className="font-mono text-xs font-bold text-teal-300">APPLE iPHONE &amp; iPAD</div>
                <h2 className="font-display text-xl font-bold text-white">
                  Safari on iOS / iPadOS
                </h2>
              </div>
              <img
                src="/apple-touch-icon.png"
                alt="AI-EIA Apple iOS app icon"
                className="h-12 w-12 rounded-xl border border-teal-600/60 shadow"
              />
            </div>

            <div className="rounded-xl border border-teal-800/70 bg-[#032423] p-4 text-xs text-teal-100/85">
              Apple requires adding web apps using <strong>Safari</strong> (iOS 16.4+ supports full
              standalone mode, safe-area notch display, and offline caching).
            </div>

            <ol className="space-y-2.5 text-sm text-teal-50/90">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-400/20 font-mono text-xs font-bold text-teal-300">
                  1
                </span>
                <span>
                  Open your deployed site URL in <strong>Safari</strong> on iPhone or iPad.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-400/20 font-mono text-xs font-bold text-teal-300">
                  2
                </span>
                <span className="inline-flex flex-wrap items-center gap-1">
                  Tap the <Share className="inline h-3.5 w-3.5 text-teal-300" />{' '}
                  <strong>Share</strong> button in Safari&apos;s bottom toolbar.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-400/20 font-mono text-xs font-bold text-teal-300">
                  3
                </span>
                <span>
                  Scroll down, tap <strong>Add to Home Screen</strong>, then tap{' '}
                  <strong>Add</strong>.
                </span>
              </li>
            </ol>
          </div>
        </section>
      </div>

      {/* Included Mobile App Capabilities */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-4 space-y-1.5">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-teal-300">
            <Wifi className="h-4 w-4" />
            <span>Offline Service Worker</span>
          </div>
          <p className="text-xs leading-relaxed text-teal-100/80">
            Caches app shell, charts, and last-known Open-Meteo telemetry so readings remain
            accessible offline.
          </p>
        </div>

        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-4 space-y-1.5">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-teal-300">
            <Smartphone className="h-4 w-4" />
            <span>Mobile Bottom Tab Bar</span>
          </div>
          <p className="text-xs leading-relaxed text-teal-100/80">
            Thumb-friendly bottom tabs (Home, Live AQI, Plume, EIA Matrix) with iPhone safe-area
            notch support.
          </p>
        </div>

        <div className="rounded-xl border border-teal-800/70 bg-[#063836] p-4 space-y-1.5">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-teal-300">
            <ShieldCheck className="h-4 w-4" />
            <span>Android &amp; iOS Icons</span>
          </div>
          <p className="text-xs leading-relaxed text-teal-100/80">
            Configured with 180×180 Apple touch icon, 192×192 / 512×512 standard &amp; maskable
            Android icons, and app shortcuts.
          </p>
        </div>
      </section>

      {/* Optional Native APK / Xcode Store Build (Capacitor) */}
      <section className="rounded-2xl border border-teal-800/70 bg-[#063836] p-6 space-y-3">
        <div className="flex items-center gap-2 font-display text-base font-bold text-white">
          <Terminal className="h-4 w-4 text-teal-300" />
          <span>Optional: Package Native Android (.apk/.aab) &amp; Apple iOS (.ipa) Binaries</span>
        </div>
        <p className="text-xs leading-relaxed text-teal-100/80">
          A <code className="text-teal-200">capacitor.config.json</code> (<code className="text-teal-200">org.aieia.screening</code>)
          is included in the repository if you also want to compile store binaries locally in
          Android Studio or Xcode:
        </p>
        <pre className="overflow-x-auto rounded-lg border border-teal-800/80 bg-[#032423] p-4 font-mono text-xs text-teal-200">
{`npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npm run build
npx cap add android && npx cap add ios
npx cap sync`}
        </pre>
      </section>
    </div>
  );
}
