import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Euro, ShoppingCart } from 'lucide-react';

const FinancialDashboard = () => {
  const { data: financialData } = useQuery({
    queryKey: ['financial-dashboard'],
    queryFn: async () => {
      // Get daily revenue for last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { data: dailyData, error: dailyError } = await supabase
        .from('consumptions')
        .select('id, created_at, price_cents')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at');

      if (dailyError) throw dailyError;

      // Get product sales data
      const { data: productData, error: productError } = await supabase
        .from('consumptions')
        .select(`
          id,
          items (name),
          price_cents
        `)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (productError) throw productError;

      // Get transaction reversals to exclude refunded consumptions
      const { data: reversals, error: reversalsError } = await supabase
        .from('transaction_reversals')
        .select('original_transaction_id')
        .eq('original_transaction_type', 'consumption');
      
      if (reversalsError) throw reversalsError;
      
      const reversedIds = new Set(reversals.map(r => r.original_transaction_id));
      
      // Filter out refunded transactions
      const validDailyData = dailyData.filter(c => !reversedIds.has(c.id));
      const validProductData = productData.filter(c => !reversedIds.has(c.id));

      // Get top-up data
      const { data: topUpData, error: topUpError } = await supabase
        .from('top_ups')
        .select('amount_cents, created_at, status')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .eq('status', 'paid');

      if (topUpError) throw topUpError;

      // Process daily revenue
      const dailyRevenue: { [key: string]: number } = {};
      validDailyData.forEach(item => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        dailyRevenue[date] = (dailyRevenue[date] || 0) + item.price_cents;
      });

      const dailyChartData = Object.entries(dailyRevenue)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14) // Last 14 days
        .map(([date, revenue]) => ({
          date: new Date(date).toLocaleDateString('nl-BE', { month: 'short', day: 'numeric' }),
          revenue: revenue / 100,
        }));

      // Process product sales
      const productSales: { [key: string]: { count: number; revenue: number } } = {};
      validProductData.forEach(item => {
        const name = item.items?.name || 'Onbekend';
        if (!productSales[name]) {
          productSales[name] = { count: 0, revenue: 0 };
        }
        productSales[name].count += 1;
        productSales[name].revenue += item.price_cents;
      });

      const productChartData = Object.entries(productSales)
        .sort(([, a], [, b]) => b.revenue - a.revenue)
        .slice(0, 6)
        .map(([name, data]) => ({
          name,
          count: data.count,
          revenue: data.revenue / 100,
        }));

      // Calculate totals
      const totalRevenue = validDailyData.reduce((sum, item) => sum + item.price_cents, 0);
      const totalTopUps = topUpData.reduce((sum, item) => sum + item.amount_cents, 0);
      const totalTransactions = validDailyData.length;
      const totalTopUpTransactions = topUpData.length;

      // Calculate trends (compare last 15 days vs previous 15 days)
      const last15Days = validDailyData.filter(item => 
        new Date(item.created_at) >= new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
      );
      const previous15Days = validDailyData.filter(item => {
        const date = new Date(item.created_at);
        return date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) && 
               date < new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      });

      const currentRevenue = last15Days.reduce((sum, item) => sum + item.price_cents, 0);
      const previousRevenue = previous15Days.reduce((sum, item) => sum + item.price_cents, 0);
      const revenueTrend = previousRevenue === 0 ? 0 : ((currentRevenue - previousRevenue) / previousRevenue) * 100;

      const currentTransactions = last15Days.length;
      const previousTransactions = previous15Days.length;
      const transactionsTrend = previousTransactions === 0 ? 0 : ((currentTransactions - previousTransactions) / previousTransactions) * 100;

      return {
        totalRevenue,
        totalTopUps,
        totalTransactions,
        totalTopUpTransactions,
        revenueTrend,
        transactionsTrend,
        dailyChartData,
        productChartData,
      };
    },
  });

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-success';
    if (trend < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return TrendingUp;
    if (trend < 0) return TrendingDown;
    return Euro;
  };

  const COLORS = ['#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d', '#16a34a'];

  if (!financialData) {
    return <div className="text-center py-8">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Omzet (30 dagen)</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financialData.totalRevenue)}</div>
            <div className="flex items-center gap-1 mt-1">
              {(() => {
                const Icon = getTrendIcon(financialData.revenueTrend);
                return <Icon className={`h-3 w-3 ${getTrendColor(financialData.revenueTrend)}`} />;
              })()}
              <span className={`text-xs ${getTrendColor(financialData.revenueTrend)}`}>
                {financialData.revenueTrend > 0 ? '+' : ''}{financialData.revenueTrend.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top-ups (30 dagen)</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financialData.totalTopUps)}</div>
            <p className="text-xs text-muted-foreground">{financialData.totalTopUpTransactions} transacties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verkopen (30 dagen)</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{financialData.totalTransactions}</div>
            <div className="flex items-center gap-1 mt-1">
              {(() => {
                const Icon = getTrendIcon(financialData.transactionsTrend);
                return <Icon className={`h-3 w-3 ${getTrendColor(financialData.transactionsTrend)}`} />;
              })()}
              <span className={`text-xs ${getTrendColor(financialData.transactionsTrend)}`}>
                {financialData.transactionsTrend > 0 ? '+' : ''}{financialData.transactionsTrend.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gem. per verkoop</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(financialData.totalTransactions > 0 ? financialData.totalRevenue / financialData.totalTransactions : 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Dagelijkse omzet (laatste 14 dagen)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={financialData.dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [`€${value}`, 'Omzet']}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Product Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top producten (30 dagen)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={financialData.productChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, count }) => `${name} (${count})`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {financialData.productChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`€${value}`, 'Omzet']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Product Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product verkoop details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {financialData.productChartData.map((product, index) => (
              <div key={product.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-muted-foreground">{product.count} verkopen</div>
                  </div>
                </div>
                <Badge variant="outline">
                  {formatCurrency(product.revenue * 100)}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialDashboard;