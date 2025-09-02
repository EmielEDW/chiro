import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Package, DollarSign, BarChart3, LineChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart as RechartsLineChart, Line } from 'recharts';
import { format, subDays, subWeeks, startOfDay, startOfWeek, startOfYear, endOfDay } from 'date-fns';
import { nl } from 'date-fns/locale';

interface InventoryItem {
  id: string;
  name: string;
  stock_quantity: number;
  purchase_price_cents: number;
  price_cents: number;
  category?: string;
}

type TimePeriod = 'week' | 'month' | 'year';

const InventoryValueDashboard = () => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('year');

  const { data: items = [], isLoading: itemsLoading } = useQuery({
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

  const { data: salesData = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales-data', timePeriod],
    queryFn: async () => {
      const now = new Date();
      let startDate: Date;
      let groupBy: string;
      let dateFormat: string;

      switch (timePeriod) {
        case 'week':
          startDate = subDays(now, 6); // Last 7 days
          groupBy = "DATE(created_at)";
          dateFormat = 'dd/MM';
          break;
        case 'month':
          startDate = subDays(now, 29); // Last 30 days
          groupBy = "DATE(created_at)";
          dateFormat = 'dd/MM';
          break;
        case 'year':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1); // Last 12 months
          groupBy = "DATE_TRUNC('month', created_at)::date";
          dateFormat = 'MMM yy';
          break;
        default:
          startDate = subDays(now, 6);
          groupBy = "DATE(created_at)";
          dateFormat = 'dd/MM';
      }

      // Get consumptions with items data
      const { data: consumptions, error: consumptionsError } = await supabase
        .from('consumptions')
        .select(`
          id,
          price_cents,
          created_at,
          item_id,
          items!inner(name, purchase_price_cents)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endOfDay(now).toISOString());

      if (consumptionsError) throw consumptionsError;

      // Get reversed transaction IDs
      const { data: reversals } = await supabase
        .from('transaction_reversals')
        .select('original_transaction_id')
        .eq('original_transaction_type', 'consumption');

      const reversedIds = new Set(reversals?.map(r => r.original_transaction_id) || []);
      
      // Filter out reversed transactions
      const validConsumptions = consumptions?.filter(c => !reversedIds.has(c.id)) || [];

      // Group by date
      const groupedData: Record<string, { revenue: number; profit: number; lateFees: number }> = {};
      
      validConsumptions.forEach(consumption => {
        const date = new Date(consumption.created_at);
        let key: string;
        
        if (timePeriod === 'year') {
          key = format(new Date(date.getFullYear(), date.getMonth(), 1), dateFormat, { locale: nl });
        } else {
          key = format(date, dateFormat, { locale: nl });
        }
        
        if (!groupedData[key]) {
          groupedData[key] = { revenue: 0, profit: 0, lateFees: 0 };
        }
        
        const revenue = consumption.price_cents;
        const purchasePrice = consumption.items?.purchase_price_cents || 0;
        const profit = revenue - purchasePrice;
        const isLateFee = consumption.items?.name === 'Te laat boete';
        
        if (isLateFee) {
          // Only count late fees in their own category
          groupedData[key].lateFees += revenue;
        } else {
          // Only count regular items in revenue and profit
          groupedData[key].revenue += revenue;
          groupedData[key].profit += profit;
        }
      });

      // Fill in missing dates with 0 values
      const result = [];
      const daysToShow = timePeriod === 'week' ? 7 : timePeriod === 'month' ? 30 : 12;
      
      for (let i = daysToShow - 1; i >= 0; i--) {
        let date: Date;
        let key: string;
        
        if (timePeriod === 'year') {
          date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          key = format(date, dateFormat, { locale: nl });
        } else {
          date = subDays(now, i);
          key = format(date, dateFormat, { locale: nl });
        }
        
        result.push({
          date: key,
          revenue: (groupedData[key]?.revenue || 0) / 100,
          profit: (groupedData[key]?.profit || 0) / 100,
          lateFees: (groupedData[key]?.lateFees || 0) / 100,
        });
      }
      
      return result;
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

  const getPeriodLabel = () => {
    switch (timePeriod) {
      case 'week': return 'Laatste 7 dagen';
      case 'month': return 'Laatste 30 dagen';
      case 'year': return 'Laatste 12 maanden';
      default: return '';
    }
  };

  if (itemsLoading || salesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Overzicht Dashboard</CardTitle>
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
      {/* Time Period Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Periode selectie</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1">
            <Button 
              size="sm"
              variant={timePeriod === 'week' ? 'default' : 'outline'}
              onClick={() => setTimePeriod('week')}
            >
              W
            </Button>
            <Button 
              size="sm"
              variant={timePeriod === 'month' ? 'default' : 'outline'}
              onClick={() => setTimePeriod('month')}
            >
              M
            </Button>
            <Button 
              size="sm"
              variant={timePeriod === 'year' ? 'default' : 'outline'}
              onClick={() => setTimePeriod('year')}
            >
              J
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Revenue and Profit Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Omzet - {getPeriodLabel()}
            </CardTitle>
            <p className="text-sm text-muted-foreground">Alleen verkopen, geen opladingen</p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [`€${value.toFixed(2)}`, 'Omzet']}
                    labelFormatter={(label) => `Datum: ${label}`}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Winst - {getPeriodLabel()}
            </CardTitle>
            <p className="text-sm text-muted-foreground">Verkoop min inkoopprijs</p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [`€${value.toFixed(2)}`, 'Winst']}
                    labelFormatter={(label) => `Datum: ${label}`}
                  />
                  <Bar dataKey="profit" fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Late Fee Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Te laat boetes - {getPeriodLabel()}
          </CardTitle>
          <p className="text-sm text-muted-foreground">Inkomsten uit te laat boetes</p>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => [`€${value.toFixed(2)}`, 'Te laat boetes']}
                  labelFormatter={(label) => `Datum: ${label}`}
                />
                <Bar dataKey="lateFees" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Potential Profit Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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