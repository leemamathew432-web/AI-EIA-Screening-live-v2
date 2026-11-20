import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Navbar } from './components/Navbar';
import { OfflineBanner } from './components/PWAInstallButton';
import { ObservatoryProvider } from './context/ObservatoryContext';
import { EiaMatrixPage } from './pages/EiaMatrixPage';
import { Exports } from './pages/Exports';
import { Home } from './pages/Home';
import { LiveConditions } from './pages/LiveConditions';
import { Methods } from './pages/Methods';
import { MobileAppPage } from './pages/MobileAppPage';
import { BiominingTrackerPage } from './pages/observations/BiominingTrackerPage';
import { NightInversionPage } from './pages/observations/NightInversionPage';
import { PlumeTrajectoryPage } from './pages/observations/PlumeTrajectoryPage';
import { RiverLeachatePage } from './pages/observations/RiverLeachatePage';

export default function App() {
  return (
    <BrowserRouter>
      <ObservatoryProvider>
        <div className="min-h-screen flex flex-col bg-[#042f2e] text-[#ecfdf5]">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/live-conditions" element={<LiveConditions />} />
              <Route
                path="/observations/plume-trajectory"
                element={<PlumeTrajectoryPage />}
              />
              <Route
                path="/observations/night-inversion"
                element={<NightInversionPage />}
              />
              <Route
                path="/observations/river-leachate"
                element={<RiverLeachatePage />}
              />
              <Route
                path="/observations/biomining-tracker"
                element={<BiominingTrackerPage />}
              />
              {/* Legacy /innovations/* redirects */}
              <Route
                path="/innovations/plume-trajectory"
                element={<Navigate to="/observations/plume-trajectory" replace />}
              />
              <Route
                path="/innovations/night-inversion"
                element={<Navigate to="/observations/night-inversion" replace />}
              />
              <Route
                path="/innovations/river-leachate"
                element={<Navigate to="/observations/river-leachate" replace />}
              />
              <Route
                path="/innovations/biomining-tracker"
                element={<Navigate to="/observations/biomining-tracker" replace />}
              />
              <Route path="/eia-matrix" element={<EiaMatrixPage />} />
              <Route path="/methods" element={<Methods />} />
              <Route path="/exports" element={<Exports />} />
              <Route path="/mobile-app" element={<MobileAppPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <footer className="border-t border-teal-800/60 bg-[#032423] pt-6 pb-24 md:pb-6 no-print">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 text-xs text-teal-100/70 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                AI-EIA Screening · Brahmapuram – Kakkanad – Kadambrayar River Environmental
                Intelligence Portal
              </div>
              <div className="flex flex-wrap items-center gap-4 font-mono text-teal-300/80">
                <Link
                  to="/mobile-app"
                  className="underline decoration-teal-500/50 underline-offset-4 hover:text-teal-200"
                >
                  Mobile App (Android &amp; iOS)
                </Link>
                <span>9.9880° N, 76.3680° E · 5 km Study Radius</span>
              </div>
            </div>
          </footer>

          <MobileBottomNav />
          <OfflineBanner />
        </div>
      </ObservatoryProvider>
    </BrowserRouter>
  );
}
