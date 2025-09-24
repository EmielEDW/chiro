import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';

interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  avatar_url?: string;
  total_spent: number;
  rank: number;
}

const Leaderboard = () => {
  const [activeTab, setActiveTab] = useState('alltime');

  const getDateRange = (period: string) => {
    const now = new Date();
    const start = new Date();
    
    switch (period) {
      case '7days':
        start.setDate(now.getDate() - 7);
        break;
      case '30days':
        start.setDate(now.getDate() - 30);
        break;
      case '1year':
        start.setFullYear(now.getFullYear() - 1);
        break;
      case 'alltime':
        start.setFullYear(2000); // Far enough back to capture all data
        break;
      default:
        start.setDate(now.getDate() - 7);
    }
    
    return start.toISOString();
  };

  const { data: leaderboardData = [], isLoading } = useQuery({
    queryKey: ['leaderboard', activeTab],
    queryFn: async () => {
      const startDate = getDateRange(activeTab);
      
      const { data, error } = await supabase
        .from('consumptions')
        .select(`
          user_id,
          price_cents,
          id,
          items!consumptions_item_id_fkey (
            name
          ),
          profiles!consumptions_user_id_fkey (
            name,
            avatar_url,
            guest_account
          )
        `)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Get transaction reversals to exclude refunded consumptions
      const { data: reversals, error: reversalsError } = await supabase
        .from('transaction_reversals')
        .select('original_transaction_id')
        .eq('original_transaction_type', 'consumption');
      
      if (reversalsError) throw reversalsError;
      
      const reversedIds = new Set(reversals.map(r => r.original_transaction_id));
      
      // Filter out refunded transactions, guest accounts, late fees, and users without valid profiles  
      const validData = data.filter(consumption => 
        !reversedIds.has(consumption.id) && 
        !consumption.profiles?.guest_account &&
        consumption.profiles?.name && 
        consumption.profiles.name !== 'Onbekend' &&
        consumption.items?.name !== 'Te laat boete'
      );
      
      // Group by user and sum spending
      const userSpending = validData.reduce((acc, consumption) => {
        const userId = consumption.user_id;
        const userName = consumption.profiles?.name || 'Onbekend';
        const avatarUrl = consumption.profiles?.avatar_url;
        
        if (!acc[userId]) {
          acc[userId] = {
            user_id: userId,
            user_name: userName,
            avatar_url: avatarUrl,
            total_spent: 0,
          };
        }
        
        acc[userId].total_spent += consumption.price_cents;
        return acc;
      }, {} as Record<string, { user_id: string; user_name: string; avatar_url?: string; total_spent: number; }>);
      
      // Convert to array and sort by spending (descending)
      const leaderboard = Object.values(userSpending)
        .sort((a, b) => b.total_spent - a.total_spent)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));
      
      return leaderboard as LeaderboardEntry[];
    },
  });

  const formatCurrency = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="h-5 w-5 flex items-center justify-center text-sm font-bold">#{rank}</span>;
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500 hover:bg-yellow-600">🥇 1st</Badge>;
    if (rank === 2) return <Badge variant="secondary" className="bg-gray-400 hover:bg-gray-500 text-white">🥈 2nd</Badge>;
    if (rank === 3) return <Badge variant="outline" className="border-amber-600 text-amber-600">🥉 3rd</Badge>;
    return <Badge variant="outline">#{rank}</Badge>;
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case '7days': return 'Laatste 7 dagen';
      case '30days': return 'Laatste 30 dagen';
      case '1year': return 'Dit jaar';
      case 'alltime': return 'All-time';
      default: return 'Laatste 7 dagen';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>🏆 Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Laden...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="leaderboard">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🏆 Leaderboard
          <Badge variant="outline" className="ml-auto">
            {leaderboardData.length} deelnemers
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Zie wie het meest heeft uitgegeven aan drankjes!
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="7days">7d</TabsTrigger>
            <TabsTrigger value="30days">30d</TabsTrigger>
            <TabsTrigger value="1year">1j</TabsTrigger>
            <TabsTrigger value="alltime">All</TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab} className="mt-6">
            <div className="space-y-3">
              <h3 className="font-medium text-center mb-4">
                {getPeriodLabel(activeTab)}
              </h3>
              
              {leaderboardData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Geen data beschikbaar voor deze periode.
                </div>
              ) : (
                leaderboardData.map((entry) => (
                  <div
                    key={entry.user_id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      entry.rank <= 3
                        ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200'
                        : 'bg-card hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {getRankIcon(entry.rank)}
                      </div>
                      
                      <Avatar className="h-10 w-10">
                        {entry.avatar_url ? (
                          <AvatarImage 
                            src={entry.avatar_url} 
                            alt={`Profielfoto van ${entry.user_name}`}
                          />
                        ) : (
                          <AvatarFallback>
                            {entry.user_name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      
                      <div>
                        <div className="font-medium">{entry.user_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(entry.total_spent)} uitgegeven
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getRankBadge(entry.rank)}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {leaderboardData.length > 0 && (
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <div className="text-center text-sm text-muted-foreground">
                  <strong>Totaal uitgegeven:</strong>{' '}
                  {formatCurrency(leaderboardData.reduce((sum, entry) => sum + entry.total_spent, 0))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default Leaderboard;