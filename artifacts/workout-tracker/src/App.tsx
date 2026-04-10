import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
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
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
