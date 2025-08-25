import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRScanner } from '@/components/QRScanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ShoppingCart, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function QRScan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [scannedItemId, setScannedItemId] = useState<string | null>(null);

  // Fetch user balance
  const { data: balance = 0 } = useQuery({
    queryKey: ['balance', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase.rpc('calculate_user_balance', {
        user_uuid: user.id
      });
      if (error) throw error;
      return data || 0;
    },
    enabled: !!user,
  });

  // Fetch user profile for credit allowance
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('allow_credit')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch scanned item details
  const { data: scannedItem, isLoading: isItemLoading } = useQuery({
    queryKey: ['item', scannedItemId],
    queryFn: async () => {
      if (!scannedItemId) return null;
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', scannedItemId)
        .eq('active', true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!scannedItemId,
  });

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!user || !scannedItem) throw new Error('Missing data');
      
      // Check if user can afford the item
      const canAfford = balance >= scannedItem.price_cents || profile?.allow_credit;
      if (!canAfford) {
        throw new Error('Insufficient balance');
      }

      // Check stock
      if (scannedItem.stock_quantity !== null && scannedItem.stock_quantity <= 0) {
        throw new Error('Item out of stock');
      }

      const { error } = await supabase
        .from('consumptions')
        .insert({
          user_id: user.id,
          item_id: itemId,
          price_cents: scannedItem.price_cents,
          source: 'qr'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Successfully purchased ${scannedItem?.name}!`);
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['consumption-history'] });
      setScannedItemId(null);
    },
    onError: (error) => {
      toast.error(`Purchase failed: ${error.message}`);
    },
  });

  const handleScan = (result: string) => {
    try {
      // Try to parse as JSON first (full QR data)
      const data = JSON.parse(result);
      if (data.type === 'item' && data.itemId) {
        setScannedItemId(data.itemId);
        return;
      }
    } catch {
      // If not JSON, treat as direct item ID
      setScannedItemId(result);
    }
  };

  const handlePurchase = () => {
    if (scannedItemId) {
      purchaseMutation.mutate(scannedItemId);
    }
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const canAfford = scannedItem ? 
    (balance >= scannedItem.price_cents || profile?.allow_credit) : false;

  const isOutOfStock = scannedItem?.stock_quantity !== null && 
    scannedItem?.stock_quantity <= 0;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold">Scan QR Code</h1>
      </div>

      {!scannedItemId ? (
        <QRScanner 
          onScan={handleScan}
          onError={(error) => toast.error(error)}
        />
      ) : (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Scanned Product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isItemLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading product...</p>
              </div>
            ) : scannedItem ? (
              <>
                <div className="text-center space-y-4">
                  {scannedItem.image_url ? (
                    <img 
                      src={scannedItem.image_url} 
                      alt={scannedItem.name}
                      className="w-32 h-32 object-contain bg-white rounded border mx-auto"
                    />
                  ) : (
                    <div className="w-32 h-32 bg-muted rounded flex items-center justify-center mx-auto border">
                      <ShoppingCart className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  
                  <div>
                    <h3 className="text-lg font-semibold">{scannedItem.name}</h3>
                    {scannedItem.description && (
                      <p className="text-sm text-muted-foreground">{scannedItem.description}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl font-bold text-primary">
                      {formatCurrency(scannedItem.price_cents)}
                    </span>
                    {scannedItem.category && (
                      <Badge variant="secondary">
                        {scannedItem.category}
                      </Badge>
                    )}
                  </div>

                  {scannedItem.stock_quantity !== null && (
                    <p className="text-sm text-muted-foreground">
                      Stock: {scannedItem.stock_quantity} remaining
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-center">
                    Your balance: <span className="font-semibold">{formatCurrency(balance)}</span>
                  </p>
                  
                  {!canAfford && (
                    <p className="text-sm text-destructive text-center">
                      Insufficient balance
                    </p>
                  )}
                  
                  {isOutOfStock && (
                    <p className="text-sm text-destructive text-center">
                      Out of stock
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setScannedItemId(null)}
                    className="flex-1"
                  >
                    Scan Another
                  </Button>
                  <Button 
                    onClick={handlePurchase}
                    disabled={!canAfford || isOutOfStock || purchaseMutation.isPending}
                    className="flex-1"
                  >
                    {purchaseMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <ShoppingCart className="h-4 w-4 mr-2" />
                    )}
                    Purchase
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-destructive">Product not found</p>
                <Button 
                  variant="outline" 
                  onClick={() => setScannedItemId(null)}
                  className="mt-4"
                >
                  Scan Another
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}