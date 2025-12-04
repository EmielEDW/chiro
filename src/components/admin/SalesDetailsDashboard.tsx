import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Filter, CalendarIcon, ChevronLeft, ChevronRight, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface SaleDetail {
  id: string;
  created_at: string;
  price_cents: number;
  user_name: string;
  user_id: string;
  item_name?: string;
  item_id?: string;
  source: string;
  type: 'consumption' | 'topup';
  topup_status?: string;
  is_refunded?: boolean;
}

const ITEMS_PER_PAGE = 50;

const SalesDetailsDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'user' | 'item' | 'transaction'>('all');
  const [filterValue, setFilterValue] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);

  // Memoize default dates to prevent infinite re-renders
  const defaultDates = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return {
      startDate: thirtyDaysAgo,
      endDate: new Date()
    };
  }, []);
  
  const startDate = dateFrom || defaultDates.startDate;
  const endDate = dateTo || defaultDates.endDate;

  const { data: salesDetails = [], isLoading } = useQuery({
    queryKey: ['sales-details', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      // Fetch consumptions
      const { data: consumptionsData, error: consumptionsError } = await supabase
        .from('consumptions')
        .select(`
          id,
          created_at,
          price_cents,
          source,
          user_id,
          item_id,
          profiles!consumptions_user_id_fkey (
            name
          ),
          items!consumptions_item_id_fkey (
            name
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });
      
      if (consumptionsError) throw consumptionsError;

      // Get transaction reversals to mark refunded consumptions
      const { data: reversals, error: reversalsError } = await supabase
        .from('transaction_reversals')
        .select('original_transaction_id')
        .eq('original_transaction_type', 'consumption');
      
      if (reversalsError) throw reversalsError;
      
      const reversedIds = new Set(reversals.map(r => r.original_transaction_id));
      
      // Don't filter out refunded transactions, but mark them
      const validConsumptionsData = consumptionsData;

      // Fetch top-ups (only paid ones for admin view)
      const { data: topUpsData, error: topUpsError } = await supabase
        .from('top_ups')
        .select(`
          id,
          created_at,
          amount_cents,
          provider,
          status,
          user_id,
          profiles!top_ups_user_id_fkey (
            name
          )
        `)
        .eq('status', 'paid') // Only show paid top-ups
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });
      
      if (topUpsError) throw topUpsError;

      // Combine and format data
      const consumptions = validConsumptionsData.map((item) => ({
        id: item.id,
        created_at: item.created_at,
        price_cents: -item.price_cents, // Negative for expenses
        source: item.source,
        user_id: item.user_id,
        user_name: item.profiles?.name || 'Onbekend',
        item_id: item.item_id,
        item_name: item.items?.name || 'Onbekend product',
        type: 'consumption' as const,
        is_refunded: reversedIds.has(item.id),
      }));

      const topUps = topUpsData.map((item) => ({
        id: item.id,
        created_at: item.created_at,
        price_cents: item.amount_cents, // Positive for income
        source: item.provider,
        user_id: item.user_id,
        user_name: item.profiles?.name || 'Onbekend',
        type: 'topup' as const,
        topup_status: item.status,
      }));

      // Combine and sort by date
      const combined = [...consumptions, ...topUps].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return combined as SaleDetail[];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ['items-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const filteredSales = salesDetails.filter((sale) => {
    // Text search
    const matchesSearch = searchTerm === '' || 
      sale.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.source.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by type
    let matchesFilter = true;
    if (filterType === 'user' && filterValue) {
      matchesFilter = sale.user_id === filterValue;
    } else if (filterType === 'item' && filterValue) {
      matchesFilter = sale.item_id === filterValue;
    } else if (filterType === 'transaction' && filterValue) {
      matchesFilter = sale.type === filterValue;
    }
    
    return matchesSearch && matchesFilter;
  });

  // Pagination
  const totalPages = Math.ceil(filteredSales.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedSales = filteredSales.slice(startIndex, endIndex);

  // Reset page when filters change
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

  const getTypeBadge = (type: string, status?: string) => {
    if (type === 'topup') {
      const statusVariant = status === 'paid' ? 'default' : status === 'pending' ? 'secondary' : 'destructive';
      return <Badge variant={statusVariant}>Opwaardering</Badge>;
    }
    return <Badge variant="outline">Aankoop</Badge>;
  };

  // Mutation to reverse a transaction as admin
  const reverseTransaction = useMutation({
    mutationFn: async (consumption: SaleDetail) => {
      if (!user?.id) throw new Error('Admin not found');
      if (consumption.is_refunded) throw new Error('Transaction already reversed');
      if (consumption.type !== 'consumption') throw new Error('Can only reverse consumptions');

      // Get target user id - may be null for deleted users
      let targetUserId = consumption.user_id;
      if (!targetUserId) {
        const { data: fallbackConsumption, error: fetchErr } = await supabase
          .from('consumptions')
          .select('user_id')
          .eq('id', consumption.id)
          .maybeSingle();
        if (fetchErr) throw fetchErr;
        targetUserId = fallbackConsumption?.user_id || null;
      }

      // Record the reversal
      const { error: reversalError } = await supabase
        .from('transaction_reversals')
        .insert({
          user_id: targetUserId,
          original_transaction_id: consumption.id,
          original_transaction_type: 'consumption',
          reversal_reason: `Admin teruggedraaid: ${consumption.item_name}`,
          reversed_by: user.id // Admin doing the reversal
        });

      if (reversalError) throw reversalError;

      // Create a reversal adjustment (positive amount to refund) only if user still exists
      if (targetUserId) {
        const { error: adjustmentError } = await supabase
          .from('adjustments')
          .insert({
            user_id: targetUserId,
            delta_cents: Math.abs(consumption.price_cents), // Make it positive (refund)
            reason: `Admin teruggedraaid: ${consumption.item_name}`,
            created_by: user.id // Admin creating the adjustment
          });

        if (adjustmentError) throw adjustmentError;
      }

      // If the item has stock tracking, add it back
      if (consumption.item_name && consumption.item_id) {
        // Find the item to update stock
        const { data: itemData, error: itemFindError } = await supabase
          .from('items')
          .select('id, stock_quantity')
          .eq('id', consumption.item_id)
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
              notes: `Admin teruggedraaid: stock teruggeteld voor ${consumption.item_name}`,
              created_by: user.id
            });
        }
      }
    },
    onSuccess: () => {
      toast.success('Transactie succesvol teruggedraaid!');
      queryClient.invalidateQueries({ queryKey: ['sales-details'] });
    },
    onError: (error) => {
      toast.error(`Fout bij terugdraaien: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verkoop details (laatste 30 dagen)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Laden...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verkoop & Opwaardering Details</CardTitle>
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
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Selecteer datum"}
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
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Selecteer datum"}
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

          {/* Search and filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="search">Zoeken</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Zoek op gebruiker, product of bron..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    resetPage();
                  }}
                  className="pl-8"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <div>
                <Label htmlFor="filter-type">Filter type</Label>
                <Select
                  value={filterType}
                  onValueChange={(value: typeof filterType) => {
                    setFilterType(value);
                    setFilterValue('');
                    resetPage();
                  }}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alles</SelectItem>
                    <SelectItem value="user">Gebruiker</SelectItem>
                    <SelectItem value="item">Product</SelectItem>
                    <SelectItem value="transaction">Transactie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {filterType !== 'all' && (
                <div>
                  <Label htmlFor="filter-value">Filter waarde</Label>
                  <Select value={filterValue} onValueChange={(value) => {
                    setFilterValue(value);
                    resetPage();
                  }}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder={`Selecteer ${
                        filterType === 'user' ? 'gebruiker' : 
                        filterType === 'item' ? 'product' : 'transactie type'
                      }`} />
                    </SelectTrigger>
                    <SelectContent>
                      {filterType === 'user' ? (
                        users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))
                      ) : filterType === 'item' ? (
                        items.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="consumption">Aankopen</SelectItem>
                          <SelectItem value="topup">Opwaarderingen</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap text-xs sm:text-sm">Datum</TableHead>
                <TableHead className="hidden sm:table-cell">Gebruiker</TableHead>
                <TableHead className="text-xs sm:text-sm">Product</TableHead>
                <TableHead className="text-xs sm:text-sm">Bedrag</TableHead>
                <TableHead className="w-8 sm:w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSales.map((sale) => (
                <TableRow 
                  key={`${sale.type}-${sale.id}`}
                  className={sale.is_refunded ? "opacity-60 bg-muted/20" : ""}
                >
                  <TableCell className="font-mono text-xs sm:text-sm whitespace-nowrap p-2 sm:p-4">
                    <span className="sm:hidden">
                      {new Date(sale.created_at).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <span className="hidden sm:inline">{formatDate(sale.created_at)}</span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {sale.user_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {sale.user_name}
                    </div>
                  </TableCell>
                  <TableCell className="p-2 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                      <span className="text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">
                        {sale.type === 'consumption' ? sale.item_name : 'Opwaardering'}
                      </span>
                      <span className="text-xs text-muted-foreground sm:hidden">{sale.user_name}</span>
                      {sale.is_refunded && (
                        <Undo2 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={cn(
                    "font-medium text-xs sm:text-sm p-2 sm:p-4",
                    sale.is_refunded ? "line-through text-muted-foreground" : 
                    sale.price_cents > 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {sale.price_cents > 0 ? '+' : ''}{formatCurrency(Math.abs(sale.price_cents))}
                  </TableCell>
                  <TableCell className="p-1 sm:p-4">
                    {sale.type === 'consumption' && !sale.is_refunded && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 sm:h-8 sm:w-8 text-orange-600 hover:text-orange-700"
                          >
                            <Undo2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Transactie terugdraaien?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Weet je zeker dat je deze transactie wilt terugdraaien?
                              <br />
                              <strong>Product:</strong> {sale.item_name}
                              <br />
                              <strong>Gebruiker:</strong> {sale.user_name}
                              <br />
                              <strong>Bedrag:</strong> €{(Math.abs(sale.price_cents) / 100).toFixed(2)}
                              <br />
                              <strong>Let op:</strong> De gebruiker krijgt het geld terug en de voorraad wordt bijgewerkt.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuleren</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => reverseTransaction.mutate(sale)}
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
          
          {filteredSales.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Geen transacties gevonden voor de geselecteerde criteria.
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Pagina {currentPage} van {totalPages} ({filteredSales.length} totaal)
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
          {startIndex + 1}-{Math.min(endIndex, filteredSales.length)} van {filteredSales.length} getoond
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesDetailsDashboard;