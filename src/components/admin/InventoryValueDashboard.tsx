import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, BarChart3, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, endOfDay } from 'date-fns';
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
      let dateFormat: string;

      switch (timePeriod) {
        case 'week':
          startDate = subDays(now, 6);
          dateFormat = 'dd/MM';
          break;
        case 'month':
          startDate = subDays(now, 29);
          dateFormat = 'dd/MM';
          break;
        case 'year':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
          dateFormat = 'MMM yy';
          break;
        default:
          startDate = subDays(now, 6);
          dateFormat = 'dd/MM';
      }

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

      const { data: reversals } = await supabase
        .from('transaction_reversals')
        .select('original_transaction_id')
        .eq('original_transaction_type', 'consumption');

      const reversedIds = new Set(reversals?.map(r => r.original_transaction_id) || []);
      const validConsumptions = consumptions?.filter(c => !reversedIds.has(c.id)) || [];

      const groupedData: Record<string, { revenue: number; profit: number }> = {};
      
      validConsumptions.forEach(consumption => {
        const date = new Date(consumption.created_at);
        let key: string;
        
        if (timePeriod === 'year') {
          key = format(new Date(date.getFullYear(), date.getMonth(), 1), dateFormat, { locale: nl });
        } else {
          key = format(date, dateFormat, { locale: nl });
        }
        
        if (!groupedData[key]) {
          groupedData[key] = { revenue: 0, profit: 0 };
        }
        
        const revenue = consumption.price_cents;
        const purchasePrice = consumption.items?.purchase_price_cents || 0;
        const profit = revenue - purchasePrice;
        
        groupedData[key].revenue += revenue;
        groupedData[key].profit += profit;
      });

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
    const profitMargin = totalSaleValue > 0 ? (totalProfit / totalSaleValue) * 100 : 0;
    
    return {
      totalPurchaseValue,
      totalSaleValue,
      totalProfit,
      profitMargin,
    };
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
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Laden...</div>
        </CardContent>
      </Card>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="space-y-4">
      {/* Sales Value Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{formatCurrency(totals.totalSaleValue)}</div>
                <p className="text-xs text-muted-foreground">
                  Huidige verkoopwaarde voorraad · {totals.profitMargin.toFixed(1)}% winstmarge
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Chart with inline period selector */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Omzet
            </CardTitle>
            <div className="flex gap-1">
              <Button 
                size="sm"
                variant={timePeriod === 'week' ? 'default' : 'ghost'}
                className="h-7 px-2 text-xs"
                onClick={() => setTimePeriod('week')}
              >
                W
              </Button>
              <Button 
                size="sm"
                variant={timePeriod === 'month' ? 'default' : 'ghost'}
                className="h-7 px-2 text-xs"
                onClick={() => setTimePeriod('month')}
              >
                M
              </Button>
              <Button 
                size="sm"
                variant={timePeriod === 'year' ? 'default' : 'ghost'}
                className="h-7 px-2 text-xs"
                onClick={() => setTimePeriod('year')}
              >
                J
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  formatter={(value: number) => [`€${value.toFixed(2)}`, 'Omzet']}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Profit Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Winst
          </CardTitle>
          <p className="text-xs text-muted-foreground">{getPeriodLabel()} · Verkoop min inkoopprijs</p>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  formatter={(value: number) => [`€${value.toFixed(2)}`, 'Winst']}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Bar dataKey="profit" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryValueDashboard;
