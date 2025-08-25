import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  Users, 
  Package, 
  Euro,
  TrendingUp,
  AlertTriangle,
  Eye,
  Settings
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import UserManagement from '@/components/admin/UserManagement';
import StockManagement from '@/components/admin/StockManagement';
import FinancialDashboard from '@/components/admin/FinancialDashboard';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { profile } = useProfile();

  // Redirect if not admin
  if (profile && profile.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [usersResult, itemsResult, consumptionsResult, revenueResult] = await Promise.all([
        supabase.from('profiles').select('id, role, active').eq('active', true),
        supabase.from('items').select('id, stock_quantity, active').eq('active', true),
        supabase.from('consumptions').select('id, price_cents, created_at').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('consumptions').select('price_cents, created_at').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      const totalUsers = usersResult.data?.length || 0;
      const totalItems = itemsResult.data?.length || 0;
      const lowStockItems = itemsResult.data?.filter(item => 
        item.stock_quantity !== null && item.stock_quantity < 10
      ).length || 0;
      
      const monthlyRevenue = consumptionsResult.data?.reduce((sum, c) => sum + c.price_cents, 0) || 0;
      const weeklyRevenue = revenueResult.data?.reduce((sum, c) => sum + c.price_cents, 0) || 0;
      const monthlyTransactions = consumptionsResult.data?.length || 0;

      return {
        totalUsers,
        totalItems,
        lowStockItems,
        monthlyRevenue,
        weeklyRevenue,
        monthlyTransactions,
      };
    },
    enabled: !!user && profile?.role === 'admin',
  });

  if (!profile) {
    return <div>Laden...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/lovable-uploads/11df38ab-3cdc-4bfc-8e71-a51ec8bef666.png" 
              alt="Chiro Logo" 
              className="h-8 w-8"
            />
            <div>
              <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
              <p className="text-muted-foreground">Beheer gebruikers, voorraad en bekijk statistieken</p>
            </div>
          </div>
          <Button onClick={() => window.location.href = '/'} variant="outline">
            <Eye className="mr-2 h-4 w-4" />
            Terug naar app
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Actieve Gebruikers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Producten</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalItems || 0}</div>
              {stats?.lowStockItems > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  <span className="text-xs text-destructive">{stats.lowStockItems} weinig voorraad</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Maand Omzet</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€{((stats?.monthlyRevenue || 0) / 100).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{stats?.monthlyTransactions || 0} transacties</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Week Omzet</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€{((stats?.weeklyRevenue || 0) / 100).toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="financial" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="financial" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Financieel
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Gebruikers
            </TabsTrigger>
            <TabsTrigger value="stock" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Voorraad
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Instellingen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="financial">
            <FinancialDashboard />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="stock">
            <StockManagement />
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Systeem Instellingen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Betalingsinstellingen</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Configureer Stripe betalingen en topup opties
                      </p>
                      <Button variant="outline" size="sm">
                        Configureren
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Notificaties</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Stel waarschuwingen in voor lage voorraad
                      </p>
                      <Button variant="outline" size="sm">
                        Configureren
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;