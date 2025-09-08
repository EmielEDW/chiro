import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, ShoppingCart, Archive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface Item {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  image_url?: string;
  category?: string;
  stock_quantity?: number;
  calculated_stock?: number;
}

interface DrinkGridProps {
  balance: number;
  onDrinkLogged: () => void;
  guestUserId?: string; // Add guest user ID prop
}

const DrinkGrid = ({ balance, onDrinkLogged, guestUserId }: DrinkGridProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Use guest user ID if provided, otherwise use authenticated user ID
  const currentUserId = guestUserId || user?.id;

  // Calculate items with stock from Supabase
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items-with-stock'],
    queryFn: async () => {
      const { data: rawItems, error } = await supabase
        .from('items')
        .select('*')
        .eq('active', true)
        .or('is_default.eq.true,event_id.is.null')
        .order('price_cents', { ascending: true });

      if (error) throw error;

      // Calculate stock for mixed drinks
      const itemsWithCalculatedStock = await Promise.all(
        rawItems.map(async (item: any) => {
          if (item.category === 'mixed_drinks') {
            const { data: calculatedStock, error: stockError } = await supabase
              .rpc('calculate_mixed_drink_stock', { mixed_drink_item_id: item.id });
            
            if (stockError) {
              console.error('Error calculating stock for mixed drink:', stockError);
              return { ...item, calculated_stock: 0 };
            }
            
            return { ...item, calculated_stock: calculatedStock };
          }
          return item;
        })
      );

      return itemsWithCalculatedStock as Item[];
    },
  });

  // Fetch user favorites - only for authenticated users, not guests
  const { data: favoriteIds = [] } = useQuery({
    queryKey: ['favorites', currentUserId],
    queryFn: async () => {
      if (!currentUserId || guestUserId) return [];
      
      const { data, error } = await supabase
        .from('user_favorites')
        .select('item_id')
        .eq('user_id', currentUserId);
      
      if (error) throw error;
      return data.map(f => f.item_id);
    },
    enabled: !!currentUserId && !guestUserId, // Don't fetch favorites for guests
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ itemId, isFavorite }: { itemId: string; isFavorite: boolean }) => {
      if (!currentUserId || guestUserId) return; // No favorites for guests
      
      if (isFavorite) {
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', currentUserId)
          .eq('item_id', itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_favorites')
          .insert({ user_id: currentUserId, item_id: itemId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', currentUserId] });
    },
  });

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const canAfford = (price: number) => {
    // For guests, allow negative balance (credit purchases)
    if (guestUserId) return true;
    return balance >= price;
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'chips':
        return 'bg-yellow-100 text-yellow-800';
      case 'frisdranken':
        return 'bg-blue-100 text-blue-800';
      case 'bieren':
        return 'bg-amber-100 text-amber-800';
      case 'sterke_dranken':
        return 'bg-red-100 text-red-800';
      case 'mixed_drinks':
        return 'bg-purple-100 text-purple-800';
      case 'andere':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryName = (category?: string) => {
    switch (category) {
      case 'chips':
        return 'Chips';
      case 'frisdranken':
        return 'Frisdranken';
      case 'bieren':
        return 'Bieren';
      case 'sterke_dranken':
        return 'Sterke dranken';
      case 'mixed_drinks':
        return 'Mixed Drinks';
      case 'andere':
        return 'Andere';
      default:
        return 'Andere';
    }
  };

  const getCategoryOrder = (category?: string) => {
    switch (category) {
      case 'frisdranken':
        return 1;
      case 'bieren':
        return 2;
      case 'sterke_dranken':
        return 3;
      case 'mixed_drinks':
        return 4;
      case 'chips':
        return 5;
      case 'andere':
        return 6;
      default:
        return 7;
    }
  };

  const logDrink = async (item: Item) => {
    const stockValue = item.calculated_stock !== undefined ? item.calculated_stock : item.stock_quantity;
    
    if (stockValue === 0) {
      toast({
        title: "Niet op voorraad",
        description: "Dit product is momenteel niet beschikbaar.",
        variant: "destructive",
      });
      return;
    }
    
    // For guests, skip balance check (allow negative balance)
    if (!guestUserId && !canAfford(item.price_cents)) {
      toast({
        title: "Onvoldoende saldo",
        description: "Je hebt niet genoeg saldo om dit drankje te kopen. Laad eerst je saldo op.",
        variant: "destructive",
      });
      return;
    }

    if (!currentUserId) {
      toast({
        title: "Niet ingelogd",
        description: "Je moet ingelogd zijn om een drankje te bestellen.",
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
          user_id: currentUserId, // Use currentUserId instead of fetching user
        });

      if (error) throw error;

      toast({
        title: "Drankje gelogd!",
        description: `${item.name} voor ${formatCurrency(item.price_cents)} ${guestUserId ? 'is toegevoegd aan je tab' : 'is afgetrokken van je saldo'}.`,
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
              <Skeleton className="h-20 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Group items by category
  const groupedItems = items.reduce((groups, item) => {
    const category = item.category || 'andere';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {} as Record<string, Item[]>);

  // Sort categories by order and sort items within each category
  const sortedCategories = Object.keys(groupedItems)
    .sort((a, b) => getCategoryOrder(a) - getCategoryOrder(b))
    .map(category => ({
      category,
      items: groupedItems[category].sort((a, b) => {
        // Sort by favorite status (favorites first), then by price
        const aIsFavorite = favoriteIds.includes(a.id);
        const bIsFavorite = favoriteIds.includes(b.id);
        
        if (aIsFavorite && !bIsFavorite) return -1;
        if (!aIsFavorite && bIsFavorite) return 1;
        
        return a.price_cents - b.price_cents;
      })
    }));

  // Show favorites section at the top if any favorites exist
  const favoriteItems = items.filter(item => favoriteIds.includes(item.id));

  return (
    <div className="space-y-6">
      {/* Favorites section - only for authenticated users */}
      {favoriteItems.length > 0 && !guestUserId && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500 fill-current" />
            Favorieten
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {favoriteItems.map((item) => {
              const stockValue = item.calculated_stock !== undefined ? item.calculated_stock : item.stock_quantity;
              const isOutOfStock = stockValue === 0;
              const affordable = canAfford(item.price_cents);

              return (
                <Card 
                  key={item.id} 
                  className={`relative transition-all duration-200 ${
                    isOutOfStock ? 'opacity-50' : 
                    affordable ? 'hover:shadow-md border-primary/20' : 'opacity-75'
                  }`}
                >
                  <CardContent className="p-4 space-y-3">
                    {item.image_url && (
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-2">
                        <img 
                          src={item.image_url} 
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    
                    <div className="space-y-1">
                      <h4 className="font-medium text-sm leading-tight">{item.name}</h4>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {formatCurrency(item.price_cents)}
                      </Badge>
                      
                      <div className="flex gap-1">
                        {!guestUserId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleFavorite.mutate({ 
                              itemId: item.id, 
                              isFavorite: favoriteIds.includes(item.id) 
                            })}
                          >
                            <Heart 
                              className={`h-3 w-3 ${
                                favoriteIds.includes(item.id) 
                                  ? 'text-red-500 fill-current' 
                                  : 'text-gray-400'
                              }`} 
                            />
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => logDrink(item)}
                          disabled={isOutOfStock || (!guestUserId && !affordable)}
                        >
                          <ShoppingCart className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {stockValue !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        {isOutOfStock ? (
                          <span className="text-red-600 font-medium">Uitverkocht</span>
                        ) : (
                          <span>Voorraad: {stockValue}</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Categories */}
      {sortedCategories.map(({ category, items }) => (
        <div key={category}>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Badge className={getCategoryColor(category)}>
              {getCategoryName(category)}
            </Badge>
            <span className="text-sm text-muted-foreground">({items.length})</span>
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            {items.map((item) => {
              const stockValue = item.calculated_stock !== undefined ? item.calculated_stock : item.stock_quantity;
              const isOutOfStock = stockValue === 0;
              const affordable = canAfford(item.price_cents);
              const isFavorite = favoriteIds.includes(item.id);

              return (
                <Card 
                  key={item.id} 
                  className={`relative transition-all duration-200 ${
                    isOutOfStock ? 'opacity-50' : 
                    affordable ? 'hover:shadow-md border-primary/20' : 'opacity-75'
                  } ${isFavorite && !guestUserId ? 'ring-1 ring-red-200' : ''}`}
                >
                  <CardContent className="p-4 space-y-3">
                    {item.image_url && (
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-2">
                        <img 
                          src={item.image_url} 
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    
                    <div className="space-y-1">
                      <h4 className="font-medium text-sm leading-tight">{item.name}</h4>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {formatCurrency(item.price_cents)}
                      </Badge>
                      
                      <div className="flex gap-1">
                        {!guestUserId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleFavorite.mutate({ 
                              itemId: item.id, 
                              isFavorite: isFavorite 
                            })}
                          >
                            <Heart 
                              className={`h-3 w-3 ${
                                isFavorite 
                                  ? 'text-red-500 fill-current' 
                                  : 'text-gray-400'
                              }`} 
                            />
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => logDrink(item)}
                          disabled={isOutOfStock || (!guestUserId && !affordable)}
                        >
                          <ShoppingCart className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {stockValue !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        {isOutOfStock ? (
                          <span className="text-red-600 font-medium">Uitverkocht</span>
                        ) : (
                          <span>Voorraad: {stockValue}</span>
                        )}
                      </div>
                    )}
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