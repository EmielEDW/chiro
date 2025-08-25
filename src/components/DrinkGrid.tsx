import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Item {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
}

interface DrinkGridProps {
  balance: number;
  allowCredit: boolean;
  onDrinkLogged: () => void;
}

const DrinkGrid = ({ balance, allowCredit, onDrinkLogged }: DrinkGridProps) => {
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('active', true)
        .eq('is_default', true)
        .order('price_cents');
      
      if (error) throw error;
      return data as Item[];
    },
  });

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const canAfford = (price: number) => {
    return allowCredit || balance >= price;
  };

  const logDrink = async (item: Item) => {
    if (!canAfford(item.price_cents)) {
      toast({
        title: "Onvoldoende saldo",
        description: "Je hebt niet genoeg saldo om dit drankje te kopen. Laad eerst je saldo op.",
        variant: "destructive",
      });
      return;
    }

    try {
      const clientId = `${Date.now()}-${Math.random()}`;
      
      const { error } = await supabase
        .from('consumptions')
        .insert({
          item_id: item.id,
          price_cents: item.price_cents,
          source: 'tap',
          client_id: clientId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        });

      if (error) throw error;

      toast({
        title: "Drankje gelogd!",
        description: `${item.name} voor ${formatCurrency(item.price_cents)} is afgetrokken van je saldo.`,
      });

      onDrinkLogged();
    } catch (error) {
      toast({
        title: "Fout",
        description: "Er ging iets mis bij het loggen van je drankje.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Drankjes</h3>
      <div className="grid grid-cols-2 gap-4">
        {items.map((item) => {
          const affordable = canAfford(item.price_cents);
          
          return (
            <Card 
              key={item.id} 
              className={`transition-all ${!affordable ? 'opacity-50' : 'hover:shadow-md'}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center space-y-3">
                  <div className="text-center">
                    <h4 className="font-medium">{item.name}</h4>
                    <Badge variant="outline" className="mt-1">
                      {formatCurrency(item.price_cents)}
                    </Badge>
                  </div>
                  
                  <Button
                    onClick={() => logDrink(item)}
                    disabled={!affordable}
                    size="sm"
                    className="w-full"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    +1
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default DrinkGrid;