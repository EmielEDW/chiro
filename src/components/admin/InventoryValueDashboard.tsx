import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Package, DollarSign } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  stock_quantity: number;
  purchase_price_cents: number;
  price_cents: number;
  category?: string;
}

const InventoryValueDashboard = () => {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory-value'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, stock_quantity, purchase_price_cents, price_cents, category')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data.map(item => ({
        ...item,
        stock_quantity: item.stock_quantity || 0,
        purchase_price_cents: item.purchase_price_cents || 0,
      })) as InventoryItem[];
    },
  });

  const formatCurrency = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  const calculateTotals = () => {
    const totalPurchaseValue = items.reduce((sum, item) => 
      sum + (item.stock_quantity * item.purchase_price_cents), 0
    );
    
    const totalSaleValue = items.reduce((sum, item) => 
      sum + (item.stock_quantity * item.price_cents), 0
    );
    
    const totalProfit = totalSaleValue - totalPurchaseValue;
    const profitMargin = totalPurchaseValue > 0 ? (totalProfit / totalPurchaseValue) * 100 : 0;
    
    return {
      totalPurchaseValue,
      totalSaleValue,
      totalProfit,
      profitMargin,
      totalItems: items.reduce((sum, item) => sum + item.stock_quantity, 0),
    };
  };

  const getCategoryBadge = (category: string | null) => {
    if (!category) return <Badge variant="outline">Geen categorie</Badge>;
    
    const variants: Record<string, any> = {
      drinks: 'default',
      food: 'secondary',
      alcohol: 'destructive',
      other: 'outline',
    };
    
    return <Badge variant={variants[category] || 'outline'}>{category}</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventaris waarde</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Laden...</div>
        </CardContent>
      </Card>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium text-muted-foreground">Totale voorraad</div>
            </div>
            <div className="text-2xl font-bold">{totals.totalItems}</div>
            <p className="text-xs text-muted-foreground">items in voorraad</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium text-muted-foreground">Inkoopwaarde</div>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(totals.totalPurchaseValue)}</div>
            <p className="text-xs text-muted-foreground">totale investering</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm font-medium text-muted-foreground">Verkoopwaarde</div>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(totals.totalSaleValue)}</div>
            <p className="text-xs text-muted-foreground">potentiële omzet</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              {totals.totalProfit >= 0 ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              <div className="text-sm font-medium text-muted-foreground">Potentiële winst</div>
            </div>
            <div className={`text-2xl font-bold ${totals.totalProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(totals.totalProfit)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totals.profitMargin.toFixed(1)}% marge
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventaris details</CardTitle>
          <p className="text-sm text-muted-foreground">
            Overzicht van alle producten met voorraad waarden
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Categorie</TableHead>
                  <TableHead>Voorraad</TableHead>
                  <TableHead>Inkoopprijs</TableHead>
                  <TableHead>Verkoopprijs</TableHead>
                  <TableHead>Inkoopwaarde</TableHead>
                  <TableHead>Verkoopwaarde</TableHead>
                  <TableHead>Winst per item</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const purchaseValue = item.stock_quantity * item.purchase_price_cents;
                  const saleValue = item.stock_quantity * item.price_cents;
                  const profitPerItem = item.price_cents - item.purchase_price_cents;
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{getCategoryBadge(item.category)}</TableCell>
                      <TableCell>
                        <Badge variant={item.stock_quantity > 0 ? "default" : "secondary"}>
                          {item.stock_quantity}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(item.purchase_price_cents)}</TableCell>
                      <TableCell>{formatCurrency(item.price_cents)}</TableCell>
                      <TableCell className="font-mono">
                        {formatCurrency(purchaseValue)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatCurrency(saleValue)}
                      </TableCell>
                      <TableCell className={`font-mono ${profitPerItem >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(profitPerItem)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Geen producten gevonden.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryValueDashboard;