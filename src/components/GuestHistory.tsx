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
  const [isExpanded, setIsExpanded] = useState(false);
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

  if (historyItems.length === 0 && !isLoading) {
    return null; // Don't show empty history section
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <Button
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full p-0"
        >
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Recente Bestellingen</CardTitle>
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-3">
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-6 w-12" />
              </div>
            ))
          ) : (
            historyItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between p-3 border rounded-lg",
                  item.isReversed ? "opacity-50 bg-muted/30" : "hover:bg-muted/50"
                )}
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{item.item_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.created_at), {
                          addSuffix: true,
                          locale: nl
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-destructive">
                        -{formatCurrency(item.price_cents)}
                      </Badge>
                      {item.isReversed ? (
                        <Badge variant="secondary" className="text-xs">
                          Terugbetaald
                        </Badge>
                      ) : canReverse(item) ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-orange-600 hover:text-orange-700 h-auto px-2 py-1"
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
                </div>
              </div>
            ))
          )}
          
          {historyItems.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nog geen bestellingen geplaatst
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default GuestHistory;