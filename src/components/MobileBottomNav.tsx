import { Activity, Compass, Home, LayoutGrid, Smartphone } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const MOBILE_TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/live-conditions', label: 'Live AQI', icon: Activity, end: false },
  { to: '/observations/plume-trajectory', label: 'Plume', icon: Compass, end: false },
  { to: '/eia-matrix', label: 'EIA Matrix', icon: LayoutGrid, end: false },
  { to: '/mobile-app', label: 'Mobile App', icon: Smartphone, end: false },
];

export function MobileBottomNav() {
  return (
    <nav
      aria-label="Mobile App Navigation"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-teal-800/80 bg-[#032423]/95 backdrop-blur-md md:hidden no-print pb-safe"
    >
      <div className="grid grid-cols-5">
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'text-teal-300 font-semibold'
                    : 'text-teal-100/65 hover:text-teal-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-4 w-4 ${isActive ? 'text-teal-300' : 'text-teal-100/70'}`}
                  />
                  <span className="truncate max-w-full px-1">{tab.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
