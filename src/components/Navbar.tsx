import { ChevronDown, Download, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { PWAInstallButton } from './PWAInstallButton';

const OBSERVATION_ROUTES = [
  { code: 'I-1', label: 'Downwind Plume Trajectory', path: '/observations/plume-trajectory' },
  { code: 'I-2', label: 'Nocturnal Inversion Predictor', path: '/observations/night-inversion' },
  { code: 'I-3', label: 'River Leachate & Oxygen Sag', path: '/observations/river-leachate' },
  { code: 'I-4', label: 'Biomining & Land Recovery', path: '/observations/biomining-tracker' },
];

export function Navbar() {
  const [obsOpen, setObsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const isObsActive =
    location.pathname.startsWith('/observations') ||
    location.pathname.startsWith('/innovations');

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setObsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    setObsOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-1 py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
      isActive
        ? 'text-teal-300 border-teal-400'
        : 'text-teal-100/80 border-transparent hover:text-white hover:border-teal-700'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-teal-800/60 bg-[#042f2e]/95 backdrop-blur-md no-print">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6">
        {/* Zone 1: Brand Wordmark */}
        <Link
          to="/"
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-teal-300 transition-colors"
        >
          AI-EIA Screening
        </Link>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6" aria-label="Main Navigation">
          <NavLink to="/" end className={linkClass}>
            Dashboard
          </NavLink>

          <NavLink to="/live-conditions" className={linkClass}>
            Live Conditions
          </NavLink>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setObsOpen((p) => !p)}
              aria-expanded={obsOpen}
              className={`inline-flex items-center gap-1.5 px-1 py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                isObsActive
                  ? 'text-teal-300 border-teal-400'
                  : 'text-teal-100/80 border-transparent hover:text-white hover:border-teal-700'
              }`}
            >
              <span>Observations</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${obsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {obsOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-teal-700/80 bg-[#063836] p-2 shadow-2xl">
                {OBSERVATION_ROUTES.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.code}
                      to={item.path}
                      className={`block rounded-lg px-3 py-2 transition-colors ${
                        active
                          ? 'bg-teal-400/20 text-teal-200'
                          : 'text-teal-50 hover:bg-[#032423]'
                      }`}
                    >
                      <div className="font-mono text-[11px] font-bold text-teal-300">
                        {item.code}
                      </div>
                      <div className="text-sm font-medium">{item.label}</div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <NavLink to="/eia-matrix" className={linkClass}>
            EIA Impact Matrix
          </NavLink>

          <NavLink to="/methods" className={linkClass}>
            Methods & Sources
          </NavLink>

          <NavLink to="/exports" className={linkClass}>
            Export Centre
          </NavLink>
        </nav>

        {/* Zone 3: PWA Install + Audit Export */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:flex items-center gap-2.5">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => navigate('/exports')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-400 px-3.5 py-1.5 text-xs font-bold text-[#042f2e] hover:bg-teal-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Audit Export</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((p) => !p)}
            aria-label="Toggle Menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-teal-700 text-teal-100 lg:hidden cursor-pointer"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-teal-800/70 bg-[#032423] px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            <Link
              to="/"
              className="rounded-lg px-3 py-2 text-sm font-medium text-teal-50 hover:bg-[#063836]"
            >
              Dashboard
            </Link>
            <Link
              to="/live-conditions"
              className="rounded-lg px-3 py-2 text-sm font-medium text-teal-50 hover:bg-[#063836]"
            >
              Live Conditions
            </Link>
            <div className="px-3 pt-2 pb-1 font-mono text-xs font-semibold text-teal-300">
              Observations (4 Modules)
            </div>
            {OBSERVATION_ROUTES.map((item) => (
              <Link
                key={item.code}
                to={item.path}
                className="rounded-lg px-5 py-2 text-sm text-teal-100/85 hover:bg-[#063836]"
              >
                <span className="font-mono text-teal-300 mr-2">{item.code}</span>
                {item.label}
              </Link>
            ))}
            <Link
              to="/eia-matrix"
              className="rounded-lg px-3 py-2 text-sm font-medium text-teal-50 hover:bg-[#063836]"
            >
              EIA Impact Matrix
            </Link>
            <Link
              to="/methods"
              className="rounded-lg px-3 py-2 text-sm font-medium text-teal-50 hover:bg-[#063836]"
            >
              Methods & Sources
            </Link>
            <Link
              to="/exports"
              className="rounded-lg px-3 py-2 text-sm font-medium text-teal-50 hover:bg-[#063836]"
            >
              Export Centre
            </Link>
            <Link
              to="/mobile-app"
              className="rounded-lg px-3 py-2 text-sm font-medium text-teal-300 hover:bg-[#063836]"
            >
              Mobile App (Android &amp; iOS)
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-2 px-2">
              <PWAInstallButton onAfterAction={() => setMobileOpen(false)} />
              <button
                type="button"
                onClick={() => navigate('/exports')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-400 px-3.5 py-2 text-xs font-bold text-[#042f2e]"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Audit Export</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
