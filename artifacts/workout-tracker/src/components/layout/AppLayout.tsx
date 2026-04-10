import { Link, useLocation } from "wouter";
import { Activity, Dumbbell, Calendar as CalendarIcon, History, LayoutDashboard, LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useQueryClient } from "@tanstack/react-query";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Workouts", href: "/workouts", icon: Activity },
    { name: "Exercises", href: "/exercises", icon: Dumbbell },
    { name: "Calendar", href: "/calendar", icon: CalendarIcon },
    { name: "Log Book", href: "/log", icon: History },
  ];

  const handleLogout = async () => {
    await logout();
    queryClient.clear();
  };

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background text-foreground selection:bg-primary/30">
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur border-b border-border flex items-center justify-between px-4 h-12">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="font-mono font-black text-base tracking-tighter uppercase text-foreground">Stroxx</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-mono font-bold text-[10px] border border-primary/30">
            {initials}
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex justify-around items-center h-16 pb-safe">
        {navigation.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.name} href={item.href} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <item.icon className="h-5 w-5" />
              <span className="text-[9px] font-medium tracking-tight uppercase">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 left-0 bg-sidebar border-r border-sidebar-border z-50">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <span className="font-mono font-bold text-xl tracking-tighter uppercase text-sidebar-foreground">Stroxx</span>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"}`}>
                <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                <span className="font-mono text-sm uppercase tracking-tight">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-6 border-t border-sidebar-border">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-mono font-bold text-xs border border-primary/30 shrink-0">
                {initials}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold uppercase tracking-tight text-sidebar-foreground truncate">{user?.username}</span>
                <span className="text-[10px] text-muted-foreground font-mono">Pro Mode</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Log out"
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:pl-64 pt-12 md:pt-0 pb-16 md:pb-0 relative min-h-[100dvh]">
        <div className="max-w-6xl mx-auto p-4 md:p-8 w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
