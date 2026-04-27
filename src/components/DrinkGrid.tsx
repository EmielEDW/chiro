import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Heart, HeartOff, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { categoryBadgeClass } from '@/lib/categoryColors';
interface Item {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
  category?: string;
  description?: string;
  image_url?: string;
  stock_quantity?: number;
  calculated_stock?: number;
}

interface DrinkGridProps {
  balance: number;
  onDrinkLogged: () => void;
  isGuestMode?: boolean;
  guestUserId?: string;
}

export const DrinkGrid = ({ balance, onDrinkLogged, isGuestMode = false, guestUserId }: DrinkGridProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loggingItemId, setLoggingItemId] = useState<string | null>(null);
  const [isLogging, setIsLogging] = useState(false);
  const { bySlug } = useCategories();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data: itemsData, error } = await supabase
        .from('items')
        .select('*')
        .eq('active', true)
        .eq('is_default', true)
        .order('price_cents');

      if (error) throw error;

      return (itemsData ?? []).map((item) => ({
        ...item,
        calculated_stock: item.stock_quantity ?? 0,
      })) as Item[];
    },
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user?.id || isGuestMode) return [];
      const { data, error } = await supabase
        .from('user_favorites')
        .select('item_id')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data.map(f => f.item_id);
    },
    enabled: !!user?.id && !isGuestMode,
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
    // Voor gasten altijd toestaan (kunnen negatief gaan)
    if (isGuestMode) return true;
    return balance >= price;
  };

  const getCategoryName = (slug?: string) =>
    (slug && bySlug.get(slug)?.name) || 'Andere';

  const getCategoryColorClass = (slug?: string) =>
    categoryBadgeClass(slug ? bySlug.get(slug)?.color : null);

  const getCategoryOrder = (slug?: string) =>
    (slug && bySlug.get(slug)?.sort_order) ?? 9999;

  const logDrink = async (item: Item) => {
    if (isLogging) return; // prevent any click while a log is in progress
    setIsLogging(true);
    setLoggingItemId(item.id);

    const stockValue = item.calculated_stock !== undefined ? item.calculated_stock : item.stock_quantity;
    
    if (stockValue !== null && stockValue !== undefined && stockValue <= 0) {
      toast({
        title: "Niet op voorraad",
        description: "Dit product is momenteel niet beschikbaar.",
        variant: "destructive",
      });
      setLoggingItemId(null);
      setIsLogging(false);
      return;
    }

    if (!canAfford(item.price_cents) && !isGuestMode) {
      toast({
        title: "Onvoldoende saldo",
        description: "Je hebt niet genoeg saldo om dit drankje te kopen. Laad eerst je saldo op.",
        variant: "destructive",
      });
      setLoggingItemId(null);
      setIsLogging(false);
      return;
    }

    try {
      const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const userId = isGuestMode ? guestUserId : user?.id;

      if (!userId) {
        toast({
          title: "Fout",
          description: "Je bent niet ingelogd. Log opnieuw in.",
          variant: "destructive",
        });
        setLoggingItemId(null);
        setIsLogging(false);
        return;
      }

      const { error } = await supabase
        .from('consumptions')
        .insert({
          item_id: item.id,
          price_cents: item.price_cents,
          source: 'tap',
          client_id: clientId,
          user_id: userId,
        });

      if (error) throw error;

      toast({
        title: "Drankje gelogd!",
        description: `${item.name} voor ${formatCurrency(item.price_cents)} is afgetrokken van je saldo.`,
      });

      // Refresh stock quantities
      queryClient.invalidateQueries({ queryKey: ['items'] });
      onDrinkLogged();
    } catch (error: any) {
      const message = error?.message || '';
      let description = "Er ging iets mis bij het loggen van je drankje.";

      if (message.includes('Onvoldoende saldo')) {
        description = "Je hebt niet genoeg saldo. Laad eerst je saldo op.";
      } else if (message.includes('Onvoldoende voorraad')) {
        description = "Dit product is niet meer op voorraad.";
      } else if (message.includes('consumptions_client_id_unique') || message.includes('duplicate key')) {
        description = "Dit drankje was al geregistreerd. Probeer opnieuw.";
      }

      toast({
        title: "Fout",
        description,
        variant: "destructive",
      });
    } finally {
      setLoggingItemId(null);
      setIsLogging(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

  // Group items by category and sort within each category
  const groupedItems = items.reduce((acc, item) => {
    const category = item.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, Item[]>);

  // Sort categories by order and items within each category (favorites first, then by price)
  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    return getCategoryOrder(a) - getCategoryOrder(b);
  });

  // Sort items within each category
  Object.keys(groupedItems).forEach(category => {
    groupedItems[category].sort((a, b) => {
      const aIsFavorite = favorites.includes(a.id);
      const bIsFavorite = favorites.includes(b.id);
      
      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;
      return a.price_cents - b.price_cents;
    });
  });

  // Get favorite items for the top section
  const favoriteItems = items.filter(item => favorites.includes(item.id));

  return (
    <div className="space-y-6">
      {/* Favorites section at the top */}
      {favoriteItems.length > 0 && !isGuestMode && (
        <div className="space-y-4" data-category="favorites">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary fill-primary" />
            <h3 className="text-lg font-semibold text-primary">Favorieten</h3>
            <Badge 
              variant="default" 
              className="text-xs bg-primary text-primary-foreground"
            >
              {favoriteItems.length} items
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {favoriteItems.map((item) => {
              const affordable = canAfford(item.price_cents);
              const isFavorite = favorites.includes(item.id);
              const isLowStock = (item.calculated_stock !== undefined ? item.calculated_stock : item.stock_quantity) !== null && (item.calculated_stock !== undefined ? item.calculated_stock : item.stock_quantity) < 10;
              const stockValue = item.calculated_stock !== undefined ? item.calculated_stock : item.stock_quantity;
              const isOutOfStock = stockValue === 0;
              
              return (
                <Card 
                  key={`favorite-${item.id}`} 
                  className={`transition-all relative bg-gradient-to-t from-primary/10 to-white hover:from-primary/20 hover:to-white border-primary/30 ${!affordable || isOutOfStock ? 'opacity-50' : 'hover:shadow-lg'} ring-2 ring-primary/50`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col space-y-3">
                      {/* Image placeholder */}
                      <div className="relative">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.name}
                            className="w-full h-32 object-contain rounded"
                          />
                        ) : (
                          <div className="w-full h-32 bg-muted rounded flex items-center justify-center border">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        
                        {/* Favorite button - alleen voor niet-gasten */}
                        {!isGuestMode && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite.mutate({ itemId: item.id, isFavorite });
                            }}
                          >
                            <Heart className="h-3 w-3 fill-primary text-primary" />
                          </Button>
                        )}
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
                          
                          {isOutOfStock ? (
                            <Badge variant="destructive" className="text-xs">
                              Niet beschikbaar
                            </Badge>
                          ) : isLowStock ? (
                            <Badge variant="secondary" className="text-xs">
                              Weinig voorraad: {stockValue}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          logDrink(item);
                        }}
                        disabled={!affordable || isOutOfStock || isLogging}
                        size="sm"
                        className="w-full"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        {loggingItemId === item.id ? 'Bezig...' : 'Registreer'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Regular categories */}
      {sortedCategories.map((category) => (
        <div key={category} className="space-y-4" data-category={category}>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{getCategoryName(category)}</h3>
            <Badge
              variant="secondary"
              className={`text-xs ${getCategoryColorClass(category)}`}
            >
              {groupedItems[category].length} items
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {groupedItems[category].map((item) => {
              const affordable = canAfford(item.price_cents);
              const isFavorite = favorites.includes(item.id);
              const isLowStock = (item.calculated_stock !== undefined ? item.calculated_stock : item.stock_quantity) !== null && (item.calculated_stock !== undefined ? item.calculated_stock : item.stock_quantity) < 10;
              const stockValue = item.calculated_stock !== undefined ? item.calculated_stock : item.stock_quantity;
              const isOutOfStock = stockValue === 0;
              
              return (
                <Card 
                  key={item.id} 
                  className={`transition-all relative bg-gradient-to-t from-red-100 to-white hover:from-red-200 hover:to-white ${!affordable || isOutOfStock ? 'opacity-50' : 'hover:shadow-lg'} ${isFavorite ? 'ring-2 ring-primary' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col space-y-3">
                      {/* Image placeholder */}
                      <div className="relative">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.name}
                            className="w-full h-32 object-contain rounded"
                          />
                        ) : (
                          <div className="w-full h-32 bg-muted rounded flex items-center justify-center border">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        
                        {/* Favorite button - alleen voor niet-gasten */}
                        {!isGuestMode && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite.mutate({ itemId: item.id, isFavorite });
                            }}
                          >
                            {isFavorite ? (
                              <Heart className="h-3 w-3 fill-primary text-primary" />
                            ) : (
                              <HeartOff className="h-3 w-3" />
                            )}
                          </Button>
                        )}
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
                          
                          {isOutOfStock ? (
                            <Badge variant="destructive" className="text-xs">
                              Niet beschikbaar
                            </Badge>
                          ) : isLowStock ? (
                            <Badge variant="secondary" className="text-xs">
                              Weinig voorraad: {stockValue}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          logDrink(item);
                        }}
                        disabled={!affordable || isOutOfStock || isLogging}
                        size="sm"
                        className="w-full"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        {loggingItemId === item.id ? 'Bezig...' : 'Registreer'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DrinkGrid;