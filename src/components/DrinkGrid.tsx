import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Heart, HeartOff, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Item {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
  category?: string;
  description?: string;
  image_url?: string;
  stock_quantity?: number;
}

interface DrinkGridProps {
  balance: number;
  allowCredit: boolean;
  onDrinkLogged: () => void;
}

const DrinkGrid = ({ balance, allowCredit, onDrinkLogged }: DrinkGridProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_favorites')
        .select('item_id')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data.map(f => f.item_id);
    },
    enabled: !!user?.id,
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ itemId, isFavorite }: { itemId: string; isFavorite: boolean }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      if (isFavorite) {
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('item_id', itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_favorites')
          .insert({ user_id: user.id, item_id: itemId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
    },
  });

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const canAfford = (price: number) => {
    return allowCredit || balance >= price;
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'frisdrank_pils_chips':
        return 'bg-blue-100 text-blue-800';
      case 'energy_kriek':
        return 'bg-orange-100 text-orange-800';
      case 'mixed_drink':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryName = (category?: string) => {
    switch (category) {
      case 'frisdrank_pils_chips':
        return 'Frisdrank/Pils/Chips';
      case 'energy_kriek':
        return 'Energy/Kriek';
      case 'mixed_drink':
        return 'Mixed Drink';
      default:
        return 'Overig';
    }
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
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-24 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Sort items with favorites first
  const sortedItems = items.sort((a, b) => {
    const aIsFavorite = favorites.includes(a.id);
    const bIsFavorite = favorites.includes(b.id);
    
    if (aIsFavorite && !bIsFavorite) return -1;
    if (!aIsFavorite && bIsFavorite) return 1;
    return a.price_cents - b.price_cents;
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Drankjes</h3>
      <div className="grid grid-cols-2 gap-4">
        {sortedItems.map((item) => {
          const affordable = canAfford(item.price_cents);
          const isFavorite = favorites.includes(item.id);
          const isLowStock = item.stock_quantity !== null && item.stock_quantity < 10;
          
          return (
            <Card 
              key={item.id} 
              className={`transition-all relative ${!affordable ? 'opacity-50' : 'hover:shadow-md'} ${isFavorite ? 'ring-2 ring-primary' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col space-y-3">
                  {/* Image placeholder */}
                  <div className="relative">
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.name}
                        className="w-full h-32 object-contain bg-white rounded border"
                      />
                    ) : (
                      <div className="w-full h-32 bg-muted rounded flex items-center justify-center border">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Favorite button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() => toggleFavorite.mutate({ itemId: item.id, isFavorite })}
                    >
                      {isFavorite ? (
                        <Heart className="h-3 w-3 fill-primary text-primary" />
                      ) : (
                        <HeartOff className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <h4 className="font-medium text-sm">{item.name}</h4>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                    
                    <div className="flex flex-col items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {formatCurrency(item.price_cents)}
                      </Badge>
                      
                      {item.category && (
                        <Badge variant="secondary" className={`text-xs ${getCategoryColor(item.category)}`}>
                          {getCategoryName(item.category)}
                        </Badge>
                      )}
                      
                      {isLowStock && (
                        <Badge variant="destructive" className="text-xs">
                          Weinig voorraad: {item.stock_quantity}
                        </Badge>
                      )}
                    </div>
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