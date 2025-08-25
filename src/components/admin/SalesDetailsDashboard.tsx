import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Search, Filter, CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
}

const ITEMS_PER_PAGE = 20;

const SalesDetailsDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'user' | 'item' | 'transaction'>('all');
  const [filterValue, setFilterValue] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);

  // Default to last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const startDate = dateFrom || thirtyDaysAgo;
  const endDate = dateTo || new Date();

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

      // Get transaction reversals to exclude refunded consumptions
      const { data: reversals, error: reversalsError } = await supabase
        .from('transaction_reversals')
        .select('original_transaction_id')
        .eq('original_transaction_type', 'consumption');
      
      if (reversalsError) throw reversalsError;
      
      const reversedIds = new Set(reversals.map(r => r.original_transaction_id));
      
      // Filter out refunded transactions
      const validConsumptionsData = consumptionsData.filter(c => !reversedIds.has(c.id));

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
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum & Tijd</TableHead>
                <TableHead>Gebruiker</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Product/Details</TableHead>
                <TableHead>Bedrag</TableHead>
                <TableHead>Bron</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSales.map((sale) => (
                <TableRow key={`${sale.type}-${sale.id}`}>
                  <TableCell className="font-mono text-sm">
                    {formatDate(sale.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {sale.user_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {sale.user_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getTypeBadge(sale.type, sale.topup_status)}
                  </TableCell>
                  <TableCell>
                    {sale.type === 'consumption' ? sale.item_name : 'Saldo opwaardering'}
                  </TableCell>
                  <TableCell className={cn(
                    "font-medium",
                    sale.price_cents > 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {sale.price_cents > 0 ? '+' : ''}{formatCurrency(Math.abs(sale.price_cents))}
                  </TableCell>
                  <TableCell>{getSourceBadge(sale.source, sale.type)}</TableCell>
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