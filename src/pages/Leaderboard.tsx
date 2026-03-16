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

async function fetchLeaderboard(period: Period, userId: string | undefined): Promise<{ top5: LeaderboardEntry[]; currentUser: LeaderboardEntry | null }> {
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
  const sorted = Array.from(totals.entries())
    .map(([user_id, data]) => ({ user_id, ...data }))
    .sort((a, b) => b.total_cents - a.total_cents)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  const top5 = sorted.slice(0, 5);

  // Find current user if not in top 5
  let currentUser: LeaderboardEntry | null = null;
  if (userId) {
    const userEntry = sorted.find(e => e.user_id === userId);
    if (userEntry && userEntry.rank > 5) {
      currentUser = userEntry;
    }
  }

  return { top5, currentUser };
}

function formatEuro(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return <span className="text-lg font-bold text-muted-foreground w-8 text-center">#{rank}</span>;
}

function LeaderboardRow({ entry, isCurrentUser }: { entry: LeaderboardEntry; isCurrentUser: boolean }) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl ${isCurrentUser ? 'bg-primary/10 ring-1 ring-primary/30' : 'glass'}`}>
      <div className="flex items-center justify-center w-10">
        <RankBadge rank={entry.rank} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${isCurrentUser ? 'text-primary' : ''}`}>
          {entry.name}
          {isCurrentUser && <span className="text-xs text-muted-foreground ml-2">(jij)</span>}
        </p>
      </div>
      <div className="text-right font-semibold tabular-nums">
        {formatEuro(entry.total_cents)}
      </div>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl glass">
          <Skeleton className="h-8 w-10 rounded" />
          <Skeleton className="h-5 flex-1 rounded" />
          <Skeleton className="h-5 w-20 rounded" />
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
      queryFn: () => fetchLeaderboard(period, user?.id),
      enabled: !!user?.id,
      staleTime: 60_000,
    });

  const month = useLeaderboard('month');
  const year = useLeaderboard('year');
  const all = useLeaderboard('all');

  const renderTab = (query: ReturnType<typeof useLeaderboard>) => {
    if (query.isLoading) return <LeaderboardSkeleton />;
    if (query.error) return <p className="text-center text-destructive py-8">Fout bij laden.</p>;

    const { top5, currentUser } = query.data!;

    if (top5.length === 0) {
      return <p className="text-center text-muted-foreground py-8">Nog geen data voor deze periode.</p>;
    }

    return (
      <div className="space-y-3">
        {top5.map(entry => (
          <LeaderboardRow
            key={entry.user_id}
            entry={entry}
            isCurrentUser={entry.user_id === user?.id}
          />
        ))}
        {currentUser && (
          <>
            <div className="flex justify-center py-1">
              <span className="text-muted-foreground text-sm">· · ·</span>
            </div>
            <LeaderboardRow entry={currentUser} isCurrentUser />
          </>
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
