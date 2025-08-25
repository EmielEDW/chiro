import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Search, CalendarIcon, ChevronLeft, ChevronRight, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface HistoryItem {
  id: string;
  created_at: string;
  price_cents: number;
  item_name?: string;
  source: string;
  type: 'consumption' | 'topup';
  topup_status?: string;
}

const ITEMS_PER_PAGE = 20;

export default function History() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);

  const { data: historyItems = [], isLoading } = useQuery({
    queryKey: ['user-history', user?.id, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      if (!user?.id) return [];

      const startDate = dateFrom?.toISOString() || new Date(0).toISOString();
      const endDate = dateTo?.toISOString() || new Date().toISOString();

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
        .eq('user_id', user.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });
      
      if (consumptionsError) throw consumptionsError;

      // Fetch top-ups (only paid ones for history)
      const { data: topUpsData, error: topUpsError } = await supabase
        .from('top_ups')
        .select(`
          id,
          created_at,
          amount_cents,
          provider,
          status
        `)
        .eq('user_id', user.id)
        .eq('status', 'paid') // Only show paid top-ups
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });
      
      if (topUpsError) throw topUpsError;

      // Fetch reversals to check which transactions have been reversed
      const { data: reversalsData, error: reversalsError } = await supabase
        .from('transaction_reversals')
        .select('original_transaction_id, original_transaction_type')
        .eq('user_id', user.id);
      
      if (reversalsError) throw reversalsError;

      const reversedTransactions = new Set(
        reversalsData.map(r => `${r.original_transaction_type}-${r.original_transaction_id}`)
      );

      // Combine and format data
      const consumptions = consumptionsData.map((item) => ({
        id: item.id,
        created_at: item.created_at,
        price_cents: -item.price_cents, // Negative for expenses
        source: item.source,
        item_name: item.items?.name || 'Onbekend product',
        type: 'consumption' as const,
        isReversed: reversedTransactions.has(`consumption-${item.id}`),
      }));

      const topUps = topUpsData.map((item) => ({
        id: item.id,
        created_at: item.created_at,
        price_cents: item.amount_cents, // Positive for income
        source: item.provider,
        type: 'topup' as const,
        topup_status: item.status,
        isReversed: reversedTransactions.has(`topup-${item.id}`),
      }));

      // Combine and sort by date
      const combined = [...consumptions, ...topUps].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return combined as (HistoryItem & { isReversed: boolean })[];
    },
    enabled: !!user?.id,
  });

  // Mutation to reverse a transaction
  const reverseTransaction = useMutation({
    mutationFn: async (item: HistoryItem & { isReversed: boolean }) => {
      if (!user?.id) throw new Error('User not authenticated');
      if (item.isReversed) throw new Error('Transaction already reversed');

      // First, record the reversal
      const { error: reversalError } = await supabase
        .from('transaction_reversals')
        .insert({
          user_id: user.id,
          original_transaction_id: item.id,
          original_transaction_type: item.type,
          reversal_reason: `Foutje teruggedraaid: ${item.type === 'consumption' ? item.item_name : 'opwaardering'}`,
          reversed_by: user.id
        });

      if (reversalError) throw reversalError;

      if (item.type === 'consumption') {
        // Create a reversal adjustment (positive amount to refund)
        const { error: adjustmentError } = await supabase
          .from('adjustments')
          .insert({
            user_id: user.id,
            delta_cents: Math.abs(item.price_cents), // Make it positive (refund)
            reason: `Foutje teruggedraaid: ${item.item_name}`,
            created_by: user.id
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

            // Log stock transaction
            await supabase
              .from('stock_transactions')
              .insert({
                item_id: itemData.id,
                quantity_change: 1,
                transaction_type: 'reversal',
                notes: `Foutje teruggedraaid: stock teruggeteld`,
                created_by: user.id
              });
          }
        }
      } else if (item.type === 'topup') {
        // Create a negative adjustment to reverse the top-up
        const { error: adjustmentError } = await supabase
          .from('adjustments')
          .insert({
            user_id: user.id,
            delta_cents: -Math.abs(item.price_cents), // Make it negative
            reason: `Foutje teruggedraaid: opwaardering`,
            created_by: user.id
          });

        if (adjustmentError) throw adjustmentError;
      }
    },
    onSuccess: () => {
      toast.success('Transactie succesvol teruggedraaid!');
      queryClient.invalidateQueries({ queryKey: ['user-history'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
    onError: (error) => {
      toast.error(`Fout bij terugdraaien: ${error.message}`);
    },
  });

  const filteredItems = historyItems.filter((item) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      item.item_name?.toLowerCase().includes(searchLower) ||
      item.source.toLowerCase().includes(searchLower) ||
      (item.type === 'topup' && 'opwaardering'.includes(searchLower))
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  const resetPage = () => setCurrentPage(1);

  const formatCurrency = (cents: number) => `€${(cents / 100).toFixed(2)}`;
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-BE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeBadge = (type: string, status?: string) => {
    if (type === 'topup') {
      const statusVariant = status === 'paid' ? 'default' : status === 'pending' ? 'secondary' : 'destructive';
      return <Badge variant={statusVariant}>Opwaardering</Badge>;
    }
    return <Badge variant="outline">Aankoop</Badge>;
  };

  const getSourceBadge = (source: string, type: string) => {
    if (type === 'topup') {
      return <Badge variant="default">{source}</Badge>;
    }
    
    const variants: Record<string, any> = {
      tap: 'default',
      qr: 'secondary',
      admin: 'outline',
    };
    
    return <Badge variant={variants[source] || 'outline'}>{source}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold">Geschiedenis</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Mijn Transactie Geschiedenis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold">Geschiedenis</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mijn Transactie Geschiedenis</CardTitle>
          <div className="space-y-4">
            {/* Date filters */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div>
                <Label>Van datum</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[180px] justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Alle datums"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(date) => {
                        setDateFrom(date);
                        resetPage();
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Tot datum</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[180px] justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy") : "Alle datums"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(date) => {
                        setDateTo(date);
                        resetPage();
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setDateFrom(undefined);
                  setDateTo(undefined);
                  resetPage();
                }}
              >
                Reset datums
              </Button>
            </div>

            {/* Search */}
            <div>
              <Label htmlFor="search">Zoeken</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Zoek op product of bron..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    resetPage();
                  }}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum & Tijd</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Bedrag</TableHead>
                  <TableHead>Bron</TableHead>
                  <TableHead>Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((item) => (
                  <TableRow key={`${item.type}-${item.id}`}>
                    <TableCell className="font-mono text-sm">
                      {formatDate(item.created_at)}
                    </TableCell>
                    <TableCell>
                      {getTypeBadge(item.type, item.topup_status)}
                    </TableCell>
                    <TableCell>
                      {item.type === 'consumption' ? item.item_name : 'Saldo opwaardering'}
                    </TableCell>
                    <TableCell className={cn(
                      "font-medium",
                      item.price_cents > 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {item.price_cents > 0 ? '+' : ''}{formatCurrency(Math.abs(item.price_cents))}
                    </TableCell>
                    <TableCell>{getSourceBadge(item.source, item.type)}</TableCell>
                    <TableCell>
                      {item.isReversed ? (
                        <Badge variant="secondary" className="text-xs">
                          Terugbetaald
                        </Badge>
                       ) : item.type === 'consumption' ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-orange-600 hover:text-orange-700"
                            >
                              <Undo2 className="h-4 w-4 mr-1" />
                              Foutje
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Transactie terugdraaien?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Weet je zeker dat je deze transactie wilt terugdraaien?
                                <br />
                                <strong>Details:</strong> {item.type === 'consumption' ? item.item_name : 'Saldo opwaardering'}
                                <br />
                                <strong>Bedrag:</strong> {formatCurrency(Math.abs(item.price_cents))}
                                {item.type === 'consumption' && (
                                  <><br /><strong>Let op:</strong> De voorraad wordt ook teruggeteld.</>
                                )}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuleren</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => reverseTransaction.mutate(item)}
                                disabled={reverseTransaction.isPending}
                                className="bg-orange-600 hover:bg-orange-700"
                              >
                                {reverseTransaction.isPending ? 'Bezig...' : 'Ja, terugdraaien'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || dateFrom || dateTo ? 
                  'Geen transacties gevonden voor de geselecteerde criteria.' :
                  'Nog geen transacties gevonden.'
                }
              </div>
            )}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Pagina {currentPage} van {totalPages} ({filteredItems.length} totaal)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Vorige
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Volgende
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="mt-2 text-sm text-muted-foreground">
            {startIndex + 1}-{Math.min(endIndex, filteredItems.length)} van {filteredItems.length} getoond
          </div>
        </CardContent>
      </Card>
    </div>
  );
}