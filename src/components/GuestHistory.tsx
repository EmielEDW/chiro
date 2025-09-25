import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Undo2, History, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow, isAfter, subHours } from 'date-fns';
import { nl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface GuestHistoryItem {
  id: string;
  created_at: string;
  price_cents: number;
  item_name: string;
  source: string;
  isReversed: boolean;
}

interface GuestHistoryProps {
  guestUserId: string;
  onBalanceChange: () => void;
}

export const GuestHistory = ({ guestUserId, onBalanceChange }: GuestHistoryProps) => {
  const [isExpanded, setIsExpanded] = useState(true); // Default to expanded for better UX
  const queryClient = useQueryClient();

  const { data: historyItems = [], isLoading } = useQuery({
    queryKey: ['guest-history', guestUserId],
    queryFn: async () => {
      if (!guestUserId) return [];

      // Fetch consumptions
      const { data: consumptionsData, error: consumptionsError } = await supabase
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
        .eq('user_id', guestUserId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (consumptionsError) throw consumptionsError;

      // Fetch reversals to check which transactions have been reversed
      const { data: reversalsData, error: reversalsError } = await supabase
        .from('transaction_reversals')
        .select('original_transaction_id')
        .eq('user_id', guestUserId);
      
      if (reversalsError) throw reversalsError;

      const reversedTransactions = new Set(
        reversalsData.map(r => r.original_transaction_id)
      );

      return consumptionsData.map((item) => ({
        id: item.id,
        created_at: item.created_at,
        price_cents: item.price_cents,
        source: item.source,
        item_name: item.items?.name || 'Onbekend product',
        isReversed: reversedTransactions.has(item.id),
      })) as GuestHistoryItem[];
    },
    enabled: !!guestUserId,
  });

  // Mutation to reverse a transaction for guests
  const reverseTransaction = useMutation({
    mutationFn: async (item: GuestHistoryItem) => {
      if (!guestUserId) throw new Error('Guest ID not found');
      if (item.isReversed) throw new Error('Transaction already reversed');

      // Check if transaction is within 4 hours
      const transactionTime = new Date(item.created_at);
      const fourHoursAgo = subHours(new Date(), 4);
      if (!isAfter(transactionTime, fourHoursAgo)) {
        throw new Error('Kan alleen transacties van de laatste 4 uur terugdraaien');
      }

      // Record the reversal
      const { error: reversalError } = await supabase
        .from('transaction_reversals')
        .insert({
          user_id: guestUserId,
          original_transaction_id: item.id,
          original_transaction_type: 'consumption',
          reversal_reason: `Foutje teruggedraaid: ${item.item_name}`,
          reversed_by: guestUserId
        });

      if (reversalError) throw reversalError;

      // Create a reversal adjustment (positive amount to refund)
      const { error: adjustmentError } = await supabase
        .from('adjustments')
        .insert({
          user_id: guestUserId,
          delta_cents: Math.abs(item.price_cents), // Make it positive (refund)
          reason: `Foutje teruggedraaid: ${item.item_name}`,
          created_by: guestUserId
        });

      if (adjustmentError) throw adjustmentError;

      // If the item has stock tracking, add it back
      if (item.item_name && item.item_name !== 'Onbekend product') {
        // Find the item to update stock
        const { data: itemData, error: itemFindError } = await supabase
          .from('items')
          .select('id, stock_quantity')
          .eq('name', item.item_name)
          .single();

        if (!itemFindError && itemData && itemData.stock_quantity !== null) {
          // Add stock back
          const { error: stockError } = await supabase
            .from('items')
            .update({ 
              stock_quantity: itemData.stock_quantity + 1 
            })
            .eq('id', itemData.id);

          if (stockError) throw stockError;

          // Log stock transaction (without created_by for guests)
          await supabase
            .from('stock_transactions')
            .insert({
              item_id: itemData.id,
              quantity_change: 1,
              transaction_type: 'reversal',
              notes: `Foutje teruggedraaid door gast: stock teruggeteld`,
              created_by: null // Guests don't have auth.users entry
            });
        }
      }
    },
    onSuccess: () => {
      toast.success('Foutje succesvol teruggedraaid!');
      queryClient.invalidateQueries({ queryKey: ['guest-history', guestUserId] });
      onBalanceChange(); // Refresh balance
    },
    onError: (error) => {
      toast.error(`Fout bij terugdraaien: ${error.message}`);
    },
  });

  const formatCurrency = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  const canReverse = (item: GuestHistoryItem) => {
    if (item.isReversed) return false;
    
    const transactionTime = new Date(item.created_at);
    const fourHoursAgo = subHours(new Date(), 4);
    return isAfter(transactionTime, fourHoursAgo);
  };

  // Always show history section for guests so they know the functionality exists

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <Button
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full p-0 hover:bg-transparent"
        >
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <History className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <CardTitle className="text-lg">Recente Bestellingen</CardTitle>
              <p className="text-sm text-muted-foreground">
                {historyItems.length > 0 ? `${historyItems.length} recente items` : 'Nog geen bestellingen'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {historyItems.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {historyItems.length}
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </Button>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-xl bg-gradient-to-r from-muted/50 to-transparent">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {historyItems.map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between p-4 border rounded-xl transition-all duration-200",
                    item.isReversed 
                      ? "opacity-60 bg-muted/30 border-muted" 
                      : "hover:shadow-md hover:border-primary/30 bg-gradient-to-r from-card to-card/50"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      item.isReversed 
                        ? "bg-muted-foreground" 
                        : index === 0 
                          ? "bg-primary animate-pulse" 
                          : "bg-muted-foreground/40"
                    )} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">{item.item_name}</p>
                        <Badge 
                          variant={item.isReversed ? "secondary" : "outline"} 
                          className={cn(
                            "text-xs",
                            !item.isReversed && "text-red-600 border-red-200"
                          )}
                        >
                          {item.isReversed ? "Terugbetaald" : `-${formatCurrency(item.price_cents)}`}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.created_at), {
                          addSuffix: true,
                          locale: nl
                        })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="ml-3">
                    {item.isReversed ? (
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                        ✓ Terugbetaald
                      </Badge>
                    ) : canReverse(item) ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-orange-600 hover:text-orange-700 border-orange-200 hover:bg-orange-50 h-8 px-3"
                          >
                            <Undo2 className="h-3 w-3 mr-1" />
                            Foutje
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Bestelling terugdraaien?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Weet je zeker dat je deze bestelling wilt terugdraaien?
                              <br />
                              <strong>Product:</strong> {item.item_name}
                              <br />
                              <strong>Bedrag:</strong> {formatCurrency(item.price_cents)}
                              <br />
                              <strong>Let op:</strong> Je krijgt het geld terug en de voorraad wordt bijgewerkt.
                              <br />
                              <em className="text-sm">Je kunt alleen bestellingen van de laatste 4 uur terugdraaien.</em>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuleren</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => reverseTransaction.mutate(item)}
                              disabled={reverseTransaction.isPending}
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              {reverseTransaction.isPending ? 'Bezig...' : 'Terugdraaien'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Te oud
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {historyItems.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <History className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Nog geen bestellingen
              </p>
              <p className="text-xs text-muted-foreground">
                Je bestellingen verschijnen hier zodra je iets bestelt
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default GuestHistory;