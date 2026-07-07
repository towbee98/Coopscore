import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession, getCooperative } from "../lib/auth.ts";
import {
  BellIcon,
  CoopScoreLogo,
  DashboardIcon,
  LoansIcon,
  LogoutIcon,
  MembersIcon,
  SearchIcon,
  SettingsIcon,
} from "./icons.tsx";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: DashboardIcon, end: true },
  { to: "/members", label: "Members", icon: MembersIcon, end: false },
  { to: "/loans", label: "Loans", icon: LoansIcon, end: false },
  { to: "/settings", label: "Settings", icon: SettingsIcon, end: false },
];

export function AppLayout() {
  const navigate = useNavigate();
  const cooperative = getCooperative();

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white px-4 py-5">
        <div className="mb-8 flex items-center gap-2 px-2">
          <CoopScoreLogo className="h-7 w-7 text-primary-700" />
          <div>
            <p className="text-base font-bold leading-tight text-primary-700">CoopScore</p>
            <p className="text-xs text-neutral-500">Admin Terminal</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-primary-700 text-white" : "text-neutral-500 hover:bg-neutral-100"
                }`
              }
            >
              <Icon className="h-4.5 w-4.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
        >
          <LogoutIcon className="h-4.5 w-4.5" />
          Logout
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
          <span className="relative flex w-80 items-center">
            <SearchIcon className="pointer-events-none absolute left-3 h-4 w-4 text-neutral-500" />
            <input
              type="search"
              placeholder="Search members, loans..."
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm placeholder:text-neutral-500 focus:border-primary-700 focus:outline-none"
            />
          </span>
          <div className="flex items-center gap-4">
            <BellIcon className="h-5 w-5 text-neutral-500" />
            <div className="h-8 w-8 rounded-full bg-primary-100 text-center text-sm font-semibold leading-8 text-primary-700">
              {cooperative?.name.charAt(0).toUpperCase() ?? "C"}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
