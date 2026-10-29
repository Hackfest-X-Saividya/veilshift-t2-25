import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, FileText, FlaskConical, FolderGit2, GitCompareArrows, History, LayoutDashboard, Menu, Moon, Network, ScanSearch, Search, Settings, ShieldAlert, Sun, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { hydrate, updateSettings, useDB } from "@/lib/friday/store";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderGit2 },
  { to: "/scan", label: "New Scan", icon: ScanSearch },
  { to: "/findings", label: "Findings", icon: ShieldAlert },
  { to: "/graph", label: "Security Graph", icon: Network },
  { to: "/lab", label: "Countermeasure Lab", icon: FlaskConical },
  { to: "/history", label: "Scan History", icon: History },
  { to: "/compare", label: "Compare", icon: GitCompareArrows },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-xs">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="18" r="2.5" />
          <path d="M7 6h10M6 8l5 8M18 8l-5 8" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="flex items-center gap-1.5 font-bold tracking-wider text-sm text-foreground">
          <span>FRIDAY</span>
          <span className="size-1.5 rounded-full bg-primary" />
        </div>
        <div className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground font-medium">Security Platform</div>
      </div>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { settings, issues } = useDB();
  const open = Object.values(issues).filter((i) => i.status !== "fixed").length;
  return (
    <div className="flex h-full flex-col justify-between p-3">
      <div>
        <div className="px-3 py-2.5">
          <Logo />
        </div>
        <nav className="mt-3 space-y-0.5">
          {NAV.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            const I = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={onNavigate}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
                )}
              >
                <I className={cn("size-3.5", active ? "text-primary-foreground" : "text-muted-foreground")} />
                <span className="flex-1">{n.label}</span>
                {n.to === "/findings" && open > 0 && (
                  <span className={cn(
                    "rounded px-1.5 py-0.2 font-mono text-[10px] font-bold",
                    active ? "bg-white/20 text-primary-foreground" : "bg-primary/10 text-primary"
                  )}>
                    {open}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card p-3 shadow-xs space-y-2">
        <div>
          <div className="eyebrow text-[9px]">Workspace</div>
          <div className="truncate text-xs font-semibold text-foreground mt-0.5">{settings.workspaceName}</div>
        </div>
        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border">
          <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            In-Browser Rules
          </span>
          <Link to="/settings" onClick={onNavigate} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <Settings className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Crumbs() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const seg = path.split("/").filter(Boolean);
  const nav = NAV.find((n) => n.to !== "/" && path.startsWith(n.to));
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs font-medium">
      <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors font-semibold">
        FRIDAY
      </Link>
      <span className="text-muted-foreground/40">/</span>
      <span className="truncate text-foreground font-semibold">{nav ? nav.label : "Overview"}</span>
      {seg.length > 1 && (
        <>
          <span className="text-muted-foreground/40">/</span>
          <span className="truncate font-mono text-[10px] rounded bg-muted px-1.5 py-0.5 border border-border text-muted-foreground">detail</span>
        </>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { settings, projects, ready } = useDB();
  const [mobile, setMobile] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  useEffect(() => { hydrate(); }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("light", settings.theme !== "dark");
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);

  return (
    <div className="relative min-h-screen w-full bg-background text-foreground flex">
      {/* Structural Desktop Sidebar */}
      <aside className="sticky top-0 z-30 hidden h-screen w-[220px] shrink-0 border-r border-border bg-sidebar lg:block">
        <SidebarBody />
      </aside>

      {/* Mobile Drawer */}
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-[260px] border-r border-border bg-sidebar p-0">
          <SidebarBody onNavigate={() => setMobile(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Crisp Header */}
        <header className="sticky top-0 z-20 flex h-13 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-md sm:px-6">
          <button className="rounded p-1.5 text-muted-foreground hover:bg-muted lg:hidden transition-colors" onClick={() => setMobile(true)} aria-label="Open navigation">
            <Menu className="size-4" />
          </button>
          <Crumbs />

          <div className="ml-auto flex items-center gap-2">
            {projects.length > 0 && (
              <select
                aria-label="Select project"
                className="hidden h-8 max-w-[180px] rounded-md border border-border bg-background px-2.5 text-xs font-medium outline-none transition-all md:block text-foreground"
                value=""
                onChange={(e) => e.target.value && navigate({ to: "/projects/$projectId", params: { projectId: e.target.value } })}
              >
                <option value="" className="bg-popover text-foreground">Switch Project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-popover text-foreground">
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {/* Clean Search Input */}
            <form onSubmit={(e) => { e.preventDefault(); navigate({ to: "/findings", search: { q: q || undefined } }); }} className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search findings…"
                className="h-8 w-52 rounded-md border border-border bg-background pl-8 pr-2.5 text-xs outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
              />
            </form>

            <button
              aria-label="Toggle theme"
              className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              onClick={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
            >
              {settings.theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </button>

            {/* Deep Burgundy Button */}
            <Link
              to="/scan"
              className="hidden h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-[#731b32] transition-colors sm:inline-flex"
            >
              <ScanSearch className="size-3.5" />
              New scan
            </Link>
          </div>
        </header>

        {/* Content Container */}
        <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-6 sm:px-8 mb-16 lg:mb-6">
          {ready ? children : <ShellLoading />}
        </main>

        {/* Mobile Navigation Bar */}
        <div className="fixed bottom-0 inset-x-0 z-30 flex justify-around border-t border-border bg-card p-2 lg:hidden">
          {NAV.slice(0, 5).map((n) => {
            const I = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className="flex size-9 items-center justify-center rounded-md hover:bg-muted text-foreground transition-all"
              >
                <I className="size-4" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ShellLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-5 py-3 shadow-xs">
        <BarChart3 className="size-4 text-primary animate-pulse" />
        <span className="text-xs font-semibold text-foreground">Loading workspace…</span>
      </div>
    </div>
  );
}
