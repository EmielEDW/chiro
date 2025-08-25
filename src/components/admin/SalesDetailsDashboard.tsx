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
import { Search, Filter } from 'lucide-react';

interface SaleDetail {
  id: string;
  created_at: string;
  price_cents: number;
  user_name: string;
  user_id: string;
  item_name: string;
  item_id: string;
  source: string;
}

const SalesDetailsDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'user' | 'item'>('all');
  const [filterValue, setFilterValue] = useState('');

  // Get sales from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: salesDetails = [], isLoading } = useQuery({
    queryKey: ['sales-details', thirtyDaysAgo.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
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
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data.map((item) => ({
        id: item.id,
        created_at: item.created_at,
        price_cents: item.price_cents,
        source: item.source,
        user_id: item.user_id,
        user_name: item.profiles?.name || 'Onbekend',
        item_id: item.item_id,
        item_name: item.items?.name || 'Onbekend product',
      })) as SaleDetail[];
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
      sale.item_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by type
    let matchesFilter = true;
    if (filterType === 'user' && filterValue) {
      matchesFilter = sale.user_id === filterValue;
    } else if (filterType === 'item' && filterValue) {
      matchesFilter = sale.item_id === filterValue;
    }
    
    return matchesSearch && matchesFilter;
  });

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

  const getSourceBadge = (source: string) => {
    const variants: Record<string, any> = {
      tap: 'default',
      manual: 'secondary',
      api: 'outline',
    };
    
    return <Badge variant={variants[source] || 'outline'}>{source}</Badge>;
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
        <CardTitle>Verkoop details (laatste 30 dagen)</CardTitle>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="search">Zoeken</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Zoek op gebruiker of product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <div>
              <Label htmlFor="filter-type">Filter type</Label>
              <Select
                value={filterType}
                onValueChange={(value: 'all' | 'user' | 'item') => {
                  setFilterType(value);
                  setFilterValue('');
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alles</SelectItem>
                  <SelectItem value="user">Gebruiker</SelectItem>
                  <SelectItem value="item">Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {filterType !== 'all' && (
              <div>
                <Label htmlFor="filter-value">Filter waarde</Label>
                <Select value={filterValue} onValueChange={setFilterValue}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder={`Selecteer ${filterType === 'user' ? 'gebruiker' : 'product'}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {filterType === 'user' ? (
                      users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))
                    ) : (
                      items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                <TableHead>Product</TableHead>
                <TableHead>Bedrag</TableHead>
                <TableHead>Bron</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.map((sale) => (
                <TableRow key={sale.id}>
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
                  <TableCell>{sale.item_name}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(sale.price_cents)}
                  </TableCell>
                  <TableCell>{getSourceBadge(sale.source)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredSales.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Geen verkopen gevonden voor de geselecteerde criteria.
            </div>
          )}
        </div>
        
        <div className="mt-4 text-sm text-muted-foreground">
          {filteredSales.length} verkopen getoond van {salesDetails.length} totaal
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesDetailsDashboard;