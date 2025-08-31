import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';

interface Consumption {
  id: string;
  created_at: string;
  price_cents: number;
  items: {
    name: string;
  };
}

const ConsumptionHistory = () => {
  const { user } = useAuth();

  const { data: consumptions = [], isLoading } = useQuery({
    queryKey: ['consumptions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('consumptions')
        .select(`
          id,
          created_at,
          price_cents,
          items (
            name
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as Consumption[];
    },
    enabled: !!user?.id,
  });

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recente Activiteit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (consumptions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recente Activiteit</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nog geen drankjes gelogd
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover-lift smooth-transition">
      <CardHeader>
        <CardTitle className="text-lg animate-fade-in">Recente Activiteit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {consumptions.map((consumption, index) => (
          <div
            key={consumption.id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 smooth-transition hover-lift animate-slide-in-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div>
              <p className="font-medium text-sm">{consumption.items.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(consumption.created_at), {
                  addSuffix: true,
                  locale: nl
                })}
              </p>
            </div>
            <Badge variant="outline" className="text-destructive hover-scale">
              -{formatCurrency(consumption.price_cents)}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ConsumptionHistory;