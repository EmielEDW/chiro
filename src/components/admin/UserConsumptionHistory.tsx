import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

interface Consumption {
  id: string;
  created_at: string;
  price_cents: number;
  source: string;
  items: {
    name: string;
  };
}

interface UserConsumptionHistoryProps {
  userId: string;
}

const UserConsumptionHistory = ({ userId }: UserConsumptionHistoryProps) => {
  const { data: consumptions = [], isLoading } = useQuery({
    queryKey: ['user-consumptions', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consumptions')
        .select(`
          id,
          created_at,
          price_cents,
          source,
          items (
            name
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as Consumption[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['user-consumption-stats', userId],
    queryFn: async () => {
      const [totalResult, monthResult, weekResult] = await Promise.all([
        supabase
          .from('consumptions')
          .select('price_cents')
          .eq('user_id', userId),
        supabase
          .from('consumptions')
          .select('price_cents')
          .eq('user_id', userId)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('consumptions')
          .select('price_cents')
          .eq('user_id', userId)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      const totalSpent = totalResult.data?.reduce((sum, c) => sum + c.price_cents, 0) || 0;
      const monthSpent = monthResult.data?.reduce((sum, c) => sum + c.price_cents, 0) || 0;
      const weekSpent = weekResult.data?.reduce((sum, c) => sum + c.price_cents, 0) || 0;
      
      const totalCount = totalResult.data?.length || 0;
      const monthCount = monthResult.data?.length || 0;
      const weekCount = weekResult.data?.length || 0;

      return {
        totalSpent,
        monthSpent, 
        weekSpent,
        totalCount,
        monthCount,
        weekCount,
      };
    },
  });

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'tap':
        return <Badge variant="default">App</Badge>;
      case 'manual':
        return <Badge variant="secondary">Handmatig</Badge>;
      default:
        return <Badge variant="outline">{source}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Laden...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Deze week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(stats?.weekSpent || 0)}</div>
            <p className="text-xs text-muted-foreground">{stats?.weekCount || 0} consumptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Deze maand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(stats?.monthSpent || 0)}</div>
            <p className="text-xs text-muted-foreground">{stats?.monthCount || 0} consumptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Totaal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(stats?.totalSpent || 0)}</div>
            <p className="text-xs text-muted-foreground">{stats?.totalCount || 0} consumptions</p>
          </CardContent>
        </Card>
      </div>

      {/* Consumption History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recente consumptions (laatste 100)</CardTitle>
        </CardHeader>
        <CardContent>
          {consumptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Geen consumptions gevonden
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Prijs</TableHead>
                    <TableHead>Bron</TableHead>
                    <TableHead>Datum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumptions.map((consumption) => (
                    <TableRow key={consumption.id}>
                      <TableCell className="font-medium">
                        {consumption.items.name}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(consumption.price_cents)}
                      </TableCell>
                      <TableCell>
                        {getSourceBadge(consumption.source)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(consumption.created_at), { 
                          addSuffix: true, 
                          locale: nl 
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserConsumptionHistory;