import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Trophy, Medal } from 'lucide-react';

interface LeaderboardEntry {
  user_id: string;
  name: string;
  total_cents: number;
  rank: number;
}

type Period = 'month' | 'year' | 'all';

function getPeriodStart(period: Period): string | null {
  if (period === 'all') return null;
  const now = new Date();
  if (period === 'month') {
    now.setMonth(now.getMonth() - 1);
  } else {
    now.setFullYear(now.getFullYear() - 1);
  }
  return now.toISOString();
}

async function fetchLeaderboard(period: Period): Promise<LeaderboardEntry[]> {
  const periodStart = getPeriodStart(period);

  // Fetch all reversed consumption IDs
  const { data: reversals, error: reversalsError } = await supabase
    .from('transaction_reversals')
    .select('original_transaction_id')
    .eq('original_transaction_type', 'consumption');

  if (reversalsError) throw reversalsError;

  const reversedIds = new Set(reversals.map(r => r.original_transaction_id));

  // Fetch consumptions with profile info
  let query = supabase
    .from('consumptions')
    .select('id, user_id, price_cents, created_at, profiles!inner(name, active)')

  if (periodStart) {
    query = query.gte('created_at', periodStart);
  }

  const { data: consumptions, error } = await query;
  if (error) throw error;

  // Aggregate per user, excluding reversed and inactive users
  const totals = new Map<string, { name: string; total_cents: number }>();

  for (const c of consumptions) {
    if (reversedIds.has(c.id)) continue;
    const profile = c.profiles as any;
    if (!profile?.active) continue;

    const existing = totals.get(c.user_id!);
    if (existing) {
      existing.total_cents += c.price_cents;
    } else {
      totals.set(c.user_id!, {
        name: profile.name || 'Onbekend',
        total_cents: c.price_cents,
      });
    }
  }

  // Sort by total descending
  return Array.from(totals.entries())
    .map(([user_id, data]) => ({ user_id, ...data }))
    .sort((a, b) => b.total_cents - a.total_cents)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

function formatEuro(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function TopThreeCard({ entry, isCurrentUser }: { entry: LeaderboardEntry; isCurrentUser: boolean }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className={`flex items-center gap-4 p-5 rounded-2xl ${isCurrentUser ? 'bg-primary/10 ring-1 ring-primary/30' : 'glass'}`}>
      <span className="text-3xl">{medals[entry.rank - 1]}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-lg font-semibold truncate ${isCurrentUser ? 'text-primary' : ''}`}>
          {entry.name}
          {isCurrentUser && <span className="text-sm text-muted-foreground ml-2">(jij)</span>}
        </p>
      </div>
      <div className="text-right text-lg font-bold tabular-nums">
        {formatEuro(entry.total_cents)}
      </div>
    </div>
  );
}

function LeaderboardRow({ entry, isCurrentUser }: { entry: LeaderboardEntry; isCurrentUser: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isCurrentUser ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}>
      <span className="text-sm font-bold text-muted-foreground w-8 text-center">#{entry.rank}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isCurrentUser ? 'text-primary font-medium' : ''}`}>
          {entry.name}
          {isCurrentUser && <span className="text-xs text-muted-foreground ml-2">(jij)</span>}
        </p>
      </div>
      <div className="text-right text-sm tabular-nums text-muted-foreground font-medium">
        {formatEuro(entry.total_cents)}
      </div>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-5 rounded-2xl glass">
          <Skeleton className="h-9 w-9 rounded" />
          <Skeleton className="h-6 flex-1 rounded" />
          <Skeleton className="h-6 w-24 rounded" />
        </div>
      ))}
      {[...Array(4)].map((_, i) => (
        <div key={i + 3} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-8 rounded" />
          <Skeleton className="h-4 flex-1 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const useLeaderboard = (period: Period) =>
    useQuery({
      queryKey: ['leaderboard', period],
      queryFn: () => fetchLeaderboard(period),
      enabled: !!user?.id,
      staleTime: 60_000,
    });

  const month = useLeaderboard('month');
  const year = useLeaderboard('year');
  const all = useLeaderboard('all');

  const renderTab = (query: ReturnType<typeof useLeaderboard>) => {
    if (query.isLoading) return <LeaderboardSkeleton />;
    if (query.error) return <p className="text-center text-destructive py-8">Fout bij laden.</p>;

    const entries = query.data!;

    if (entries.length === 0) {
      return <p className="text-center text-muted-foreground py-8">Nog geen data voor deze periode.</p>;
    }

    const top3 = entries.slice(0, 3);
    const rest = entries.slice(3);

    return (
      <div className="space-y-3">
        {top3.map(entry => (
          <TopThreeCard
            key={entry.user_id}
            entry={entry}
            isCurrentUser={entry.user_id === user?.id}
          />
        ))}
        {rest.length > 0 && (
          <div className="mt-2 space-y-1">
            {rest.map(entry => (
              <LeaderboardRow
                key={entry.user_id}
                entry={entry}
                isCurrentUser={entry.user_id === user?.id}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="glass sticky top-0 z-40 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="glass-button rounded-full"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Trophy className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Leaderboard</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-lg">
        <Tabs defaultValue="month">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="month">Maand</TabsTrigger>
            <TabsTrigger value="year">Jaar</TabsTrigger>
            <TabsTrigger value="all">Altijd</TabsTrigger>
          </TabsList>

          <TabsContent value="month">{renderTab(month)}</TabsContent>
          <TabsContent value="year">{renderTab(year)}</TabsContent>
          <TabsContent value="all">{renderTab(all)}</TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
