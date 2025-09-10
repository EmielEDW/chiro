import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Undo2 } from 'lucide-react';
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
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Consumption {
  id: string;
  created_at: string;
  price_cents: number;
  source: string;
  items: {
    name: string;
  };
  is_refunded?: boolean;
}

interface UserConsumptionHistoryProps {
  userId: string;
}

const UserConsumptionHistory = ({ userId }: UserConsumptionHistoryProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

      // Get refunded consumption IDs
      const { data: reversals, error: reversalsError } = await supabase
        .from('transaction_reversals')
        .select('original_transaction_id')
        .eq('original_transaction_type', 'consumption');
      
      if (reversalsError) throw reversalsError;
      
      const refundedIds = new Set(reversals.map(r => r.original_transaction_id));

      // Add refund status to consumptions
      const consumptionsWithRefundStatus = data.map(consumption => ({
        ...consumption,
        is_refunded: refundedIds.has(consumption.id)
      }));
      
      return consumptionsWithRefundStatus as Consumption[];
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

  // Mutation to reverse a transaction as admin
  const reverseTransaction = useMutation({
    mutationFn: async (consumption: Consumption) => {
      if (!user?.id) throw new Error('Admin not found');
      if (consumption.is_refunded) throw new Error('Transaction already reversed');

      // Record the reversal
      const { error: reversalError } = await supabase
        .from('transaction_reversals')
        .insert({
          user_id: userId,
          original_transaction_id: consumption.id,
          original_transaction_type: 'consumption',
          reversal_reason: `Admin teruggedraaid: ${consumption.items.name}`,
          reversed_by: user.id // Admin doing the reversal
        });

      if (reversalError) throw reversalError;

      // Create a reversal adjustment (positive amount to refund)
      const { error: adjustmentError } = await supabase
        .from('adjustments')
        .insert({
          user_id: userId,
          delta_cents: Math.abs(consumption.price_cents), // Make it positive (refund)
          reason: `Admin teruggedraaid: ${consumption.items.name}`,
          created_by: user.id // Admin creating the adjustment
        });

      if (adjustmentError) throw adjustmentError;

      // If the item has stock tracking, add it back
      if (consumption.items.name) {
        // Find the item to update stock
        const { data: itemData, error: itemFindError } = await supabase
          .from('items')
          .select('id, stock_quantity')
          .eq('name', consumption.items.name)
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

          // Log stock transaction
          await supabase
            .from('stock_transactions')
            .insert({
              item_id: itemData.id,
              quantity_change: 1,
              transaction_type: 'reversal',
              notes: `Admin teruggedraaid: stock teruggeteld voor ${consumption.items.name}`,
              created_by: user.id
            });
        }
      }
    },
    onSuccess: () => {
      toast.success('Transactie succesvol teruggedraaid!');
      queryClient.invalidateQueries({ queryKey: ['user-consumptions', userId] });
      queryClient.invalidateQueries({ queryKey: ['user-consumption-stats', userId] });
    },
    onError: (error) => {
      toast.error(`Fout bij terugdraaien: ${error.message}`);
    },
  });

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
                    <TableHead>Status</TableHead>
                    <TableHead>Bron</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Actie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumptions.map((consumption) => (
                    <TableRow 
                      key={consumption.id} 
                      className={consumption.is_refunded ? "opacity-60 bg-muted/20" : ""}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {consumption.items.name}
                          {consumption.is_refunded && (
                            <Undo2 className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={consumption.is_refunded ? "line-through text-muted-foreground" : ""}>
                        {formatCurrency(consumption.price_cents)}
                      </TableCell>
                      <TableCell>
                        {consumption.is_refunded ? (
                          <Badge variant="secondary" className="text-xs">
                            <Undo2 className="h-3 w-3 mr-1" />
                            Gerefund
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-xs">Betaald</Badge>
                        )}
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
                      <TableCell>
                        {!consumption.is_refunded && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-orange-600 hover:text-orange-700 h-auto px-2 py-1"
                              >
                                <Undo2 className="h-3 w-3 mr-1" />
                                Terugdraaien
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Transactie terugdraaien?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Weet je zeker dat je deze transactie wilt terugdraaien?
                                  <br />
                                  <strong>Product:</strong> {consumption.items.name}
                                  <br />
                                  <strong>Bedrag:</strong> {formatCurrency(consumption.price_cents)}
                                  <br />
                                  <strong>Let op:</strong> De gebruiker krijgt het geld terug en de voorraad wordt bijgewerkt.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => reverseTransaction.mutate(consumption)}
                                  disabled={reverseTransaction.isPending}
                                  className="bg-orange-600 hover:bg-orange-700"
                                >
                                  {reverseTransaction.isPending ? 'Bezig...' : 'Terugdraaien'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
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