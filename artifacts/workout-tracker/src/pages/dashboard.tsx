import { 
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetRecentLogs, getGetRecentLogsQueryKey,
  useGetUpcomingWorkouts, getGetUpcomingWorkoutsQueryKey,
  useGetWeeklyVolume, getGetWeeklyVolumeQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Dumbbell, Activity, CalendarDays, CalendarCheck, ArrowRight, Clock } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: recentLogs, isLoading: loadingLogs } = useGetRecentLogs({ query: { queryKey: getGetRecentLogsQueryKey() } });
  const { data: upcoming, isLoading: loadingUpcoming } = useGetUpcomingWorkouts({ query: { queryKey: getGetUpcomingWorkoutsQueryKey() } });
  const { data: volume, isLoading: loadingVolume } = useGetWeeklyVolume({ query: { queryKey: getGetWeeklyVolumeQueryKey() } });

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      <header>
        <h1 className="text-3xl md:text-4xl font-mono font-black tracking-tighter uppercase mb-2 text-foreground">Dashboard</h1>
        <p className="text-muted-foreground font-mono text-sm">Your athletic telemetry.</p>
      </header>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="Total Logged" 
          value={loadingSummary ? "-" : summary?.totalWorkoutsLogged || 0} 
          icon={Dumbbell}
        />
        <StatCard 
          title="This Week" 
          value={loadingSummary ? "-" : summary?.workoutsThisWeek || 0} 
          icon={Activity}
          highlight={true}
        />
        <StatCard 
          title="This Month" 
          value={loadingSummary ? "-" : summary?.workoutsThisMonth || 0} 
          icon={CalendarDays}
        />
        <StatCard 
          title="Upcoming" 
          value={loadingSummary ? "-" : summary?.scheduledThisWeek || 0} 
          icon={CalendarCheck}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Weekly Volume Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {loadingVolume ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-pulse flex space-x-4 items-end h-full pt-10">
                      {[...Array(7)].map((_, i) => (
                        <div key={i} className="w-8 bg-muted rounded-t-sm" style={{ height: `${Math.random() * 80 + 20}%` }}></div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volume || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="week" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '4px' }}
                        itemStyle={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                        labelStyle={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}
                      />
                      <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '12px', paddingTop: '20px' }} />
                      <Bar dataKey="bodybuilding" name="Bodybuilding" stackId="a" fill="hsl(var(--chart-1))" />
                      <Bar dataKey="amrap" name="AMRAP" stackId="a" fill="hsl(var(--chart-2))" />
                      <Bar dataKey="emom" name="EMOM" stackId="a" fill="hsl(var(--chart-3))" />
                      <Bar dataKey="rft" name="RFT" stackId="a" fill="hsl(var(--chart-4))" />
                      <Bar dataKey="cardio" name="Cardio" stackId="a" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Recent Activity</CardTitle>
              <Link href="/log" className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-mono uppercase font-bold">
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
                  ))}
                </div>
              ) : recentLogs?.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground font-mono text-sm border border-dashed border-border rounded-md">
                  No logs yet. Get to work.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentLogs?.map((log) => (
                    <Link key={log.id} href={`/log/${log.id}`} className="block group">
                      <div className="flex items-center justify-between p-3 rounded-md border border-transparent hover:border-border hover:bg-muted/30 transition-all">
                        <div>
                          <div className="font-bold text-foreground group-hover:text-primary transition-colors">{log.workoutName}</div>
                          <div className="text-xs text-muted-foreground font-mono flex items-center gap-2 mt-1">
                            <span>{format(new Date(log.loggedAt), "MMM d, yyyy")}</span>
                            {log.durationMinutes && (
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {log.durationMinutes}m</span>
                            )}
                          </div>
                        </div>
                        <WorkoutBadge type={log.workoutType} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Area */}
        <div className="space-y-6">
          <Card className="bg-card border-border shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Upcoming</CardTitle>
              <Link href="/calendar" className="text-primary hover:text-primary/80">
                <CalendarCheck className="h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent>
              {loadingUpcoming ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-14 bg-muted animate-pulse rounded-md" />
                  ))}
                </div>
              ) : upcoming?.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground font-mono text-sm border border-dashed border-border rounded-md">
                  Nothing scheduled.
                  <div className="mt-2">
                    <Link href="/calendar" className="text-primary hover:underline">Schedule one</Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcoming?.map((workout) => (
                    <div key={workout.id} className="flex items-start p-3 rounded-md border border-border bg-card">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-sm truncate">{workout.workoutName}</span>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">{format(new Date(workout.scheduledDate), "MMM d")}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <WorkoutBadge type={workout.workoutType} />
                          <Link href={`/log/new?workoutId=${workout.workoutId}&scheduledId=${workout.id}`} className="text-xs font-mono font-bold text-primary hover:text-primary/80 uppercase">
                            Log It
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-primary border-primary/20 text-primary-foreground shadow-lg relative overflow-hidden">
            <div className="absolute -right-6 -top-6 opacity-10">
              <Dumbbell className="w-32 h-32" />
            </div>
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider">Quick Action</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4 font-medium opacity-90">Ready for today's session?</p>
              <Link href="/log/new" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-background text-foreground hover:bg-background/90 h-10 px-4 py-2 w-full font-mono uppercase tracking-tight">
                Log Workout
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, highlight = false }: { title: string, value: string | number, icon: any, highlight?: boolean }) {
  return (
    <Card className={`border-border shadow-sm ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
          <Icon className={`h-4 w-4 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        <div className={`text-2xl md:text-3xl font-black font-mono tracking-tighter ${highlight ? 'text-primary' : 'text-foreground'}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
