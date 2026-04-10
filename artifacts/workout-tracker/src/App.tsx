import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import Dashboard from "@/pages/dashboard";
import WorkoutsPage from "@/pages/workouts";
import WorkoutNewPage from "@/pages/workout-new";
import WorkoutDetailPage from "@/pages/workout-detail";
import WorkoutEditPage from "@/pages/workout-edit";
import CalendarPage from "@/pages/calendar";
import LogListPage from "@/pages/log-list";
import LogNewPage from "@/pages/log-new";
import LogDetailPage from "@/pages/log-detail";
import ExercisesPage from "@/pages/exercises";
import ExerciseDetailPage from "@/pages/exercise-detail";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if ((error as { status?: number })?.status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />

        <Route path="/workouts/new" component={WorkoutNewPage} />
        <Route path="/workouts/:id/edit" component={WorkoutEditPage} />
        <Route path="/workouts/:id" component={WorkoutDetailPage} />
        <Route path="/workouts" component={WorkoutsPage} />

        <Route path="/calendar" component={CalendarPage} />

        <Route path="/log/new" component={LogNewPage} />
        <Route path="/log/:id" component={LogDetailPage} />
        <Route path="/log" component={LogListPage} />

        <Route path="/exercises/:id" component={ExerciseDetailPage} />
        <Route path="/exercises" component={ExercisesPage} />

        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
