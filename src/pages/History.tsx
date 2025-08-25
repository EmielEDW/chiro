import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { ArrowLeft, Search, CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

      // Fetch top-ups
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
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });
      
      if (topUpsError) throw topUpsError;

      // Combine and format data
      const consumptions = consumptionsData.map((item) => ({
        id: item.id,
        created_at: item.created_at,
        price_cents: -item.price_cents, // Negative for expenses
        source: item.source,
        item_name: item.items?.name || 'Onbekend product',
        type: 'consumption' as const,
      }));

      const topUps = topUpsData.map((item) => ({
        id: item.id,
        created_at: item.created_at,
        price_cents: item.amount_cents, // Positive for income
        source: item.provider,
        type: 'topup' as const,
        topup_status: item.status,
      }));

      // Combine and sort by date
      const combined = [...consumptions, ...topUps].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return combined as HistoryItem[];
    },
    enabled: !!user?.id,
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