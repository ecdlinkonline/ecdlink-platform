"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  ChevronRight,
  Menu,
  Moon,
  Search,
  Sun,
  X
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDashboardConfig, getRoleNavigation } from "@/config/dashboard";
import type { AuthContext } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/app-shell/theme-provider";

function buildBreadcrumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);

  return parts.map((part, index) => {
    const href = `/${parts.slice(0, index + 1).join("/")}`;
    const label = part
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return { href, label };
  });
}

function SidebarContent({
  role,
  onNavigate
}: {
  role: UserRole;
  onNavigate?: () => void;
}) {
  const config = getDashboardConfig(role);
  const navItems = getRoleNavigation(role);
  const pathname = usePathname();
  const RoleIcon = config.icon;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-brand-line p-4 dark:border-slate-800">
        <Link href={config.basePath} className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-navy text-sm font-bold text-white">
            EL
          </span>
          <span>
            <span className="block text-lg font-bold text-brand-ink dark:text-white">ECDLink</span>
            <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">{config.label}</span>
          </span>
        </Link>
      </div>

      <div className="border-b border-brand-line p-4 dark:border-slate-800">
        <div className="flex items-center gap-3 rounded-lg bg-brand-accent p-3 dark:bg-slate-900">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-white text-brand-navy shadow-sm dark:bg-slate-800 dark:text-blue-200">
            <RoleIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-brand-ink dark:text-white">{config.eyebrow}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Role-based access</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3" aria-label={`${config.label} navigation`}>
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "mb-1 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                active
                  ? "bg-brand-navy text-white"
                  : "text-slate-600 hover:bg-brand-accent hover:text-brand-navy dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
              )}
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                {item.title}
              </span>
              {item.badge ? (
                <span className={cn("rounded-full px-2 py-0.5 text-xs", active ? "bg-white/15" : "bg-blue-50 text-brand-navy")}>
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AppShell({
  authContext,
  role,
  children
}: {
  authContext: AuthContext;
  role: UserRole;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const breadcrumbs = useMemo(() => buildBreadcrumbs(pathname), [pathname]);
  const config = getDashboardConfig(role);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-brand-accent text-brand-ink dark:bg-slate-950 dark:text-white">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-brand-line bg-white lg:block dark:border-slate-800 dark:bg-slate-950">
        <SidebarContent role={role} />
      </aside>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/50 lg:hidden"
          >
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="h-full w-80 max-w-[88vw] bg-white shadow-soft dark:bg-slate-950"
            >
              <div className="flex items-center justify-end border-b border-brand-line p-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-brand-line dark:border-slate-800"
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent role={role} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-brand-line bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-lg border border-brand-line lg:hidden dark:border-slate-800"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden min-w-72 items-center gap-2 rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-slate-500 md:flex dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                <Search className="h-4 w-4" />
                Search {config.label.toLowerCase()} workspace
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <button className="relative grid h-10 w-10 place-items-center rounded-lg border border-brand-line text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <Bell className="h-5 w-5" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
              </button>
              {authContext.provider === "clerk" ? (
                <UserButton afterSignOutUrl="/auth/sign-in" />
              ) : (
                <Link href="/api/auth/signout" className="text-sm font-bold text-brand-navy dark:text-blue-200">
                  Sign out
                </Link>
              )}
            </div>
          </div>

          <div className="border-t border-brand-line px-4 py-2 dark:border-slate-800 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-1 overflow-x-auto text-xs font-semibold text-slate-500 dark:text-slate-400">
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.href} className="flex items-center gap-1">
                  {index > 0 ? <ChevronRight className="h-3 w-3" /> : null}
                  <Link href={crumb.href} className={index === breadcrumbs.length - 1 ? "text-brand-ink dark:text-white" : ""}>
                    {crumb.label}
                  </Link>
                </span>
              ))}
            </nav>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
