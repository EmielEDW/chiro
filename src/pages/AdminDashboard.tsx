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
import StockAudits from '@/components/admin/StockAudits';
import RestockSessions from '@/components/admin/RestockSessions';
import ProductManagement from '@/components/admin/ProductManagement';
import SalesDetailsDashboard from '@/components/admin/SalesDetailsDashboard';
import InventoryValueDashboard from '@/components/admin/InventoryValueDashboard';
import { WebsiteQRGenerator } from '@/components/admin/WebsiteQRGenerator';
import GuestTabManagement from '@/components/admin/GuestTabManagement';
import { NotificationManagement } from '@/components/admin/NotificationManagement';

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
      const [usersResult, itemsResult, consumptionsResult, revenueResult, reversalsResult] = await Promise.all([
        supabase.from('profiles').select('id, role, active').eq('active', true),
        supabase.from('items').select('id, stock_quantity, active').eq('active', true),
        supabase.from('consumptions').select('id, price_cents, created_at').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('consumptions').select('id, price_cents, created_at').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('transaction_reversals').select('original_transaction_id').eq('original_transaction_type', 'consumption')
      ]);

      const totalUsers = usersResult.data?.length || 0;
      const totalItems = itemsResult.data?.length || 0;
      const lowStockItems = itemsResult.data?.filter(item => 
        item.stock_quantity !== null && item.stock_quantity < 10
      ).length || 0;
      
      // Filter out refunded transactions
      const reversedIds = new Set(reversalsResult.data?.map(r => r.original_transaction_id) || []);
      const validMonthlyConsumptions = consumptionsResult.data?.filter(c => !reversedIds.has(c.id)) || [];
      const validWeeklyConsumptions = revenueResult.data?.filter(c => !reversedIds.has(c.id)) || [];
      
      const monthlyRevenue = validMonthlyConsumptions.reduce((sum, c) => sum + c.price_cents, 0);
      const weeklyRevenue = validWeeklyConsumptions.reduce((sum, c) => sum + c.price_cents, 0);
      const monthlyTransactions = validMonthlyConsumptions.length;

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


        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 h-12 bg-background border-2 border-muted">
            <TabsTrigger 
              value="overview" 
              className="flex items-center justify-center gap-1 sm:gap-2 h-10 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground data-[state=active]:border-destructive data-[state=active]:shadow-sm hover:bg-muted/50 px-1 sm:px-3"
            >
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Overzicht</span>
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className="flex items-center justify-center gap-1 sm:gap-2 h-10 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground data-[state=active]:border-destructive data-[state=active]:shadow-sm hover:bg-muted/50 px-1 sm:px-3"
            >
              <Users className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Gebruikers</span>
            </TabsTrigger>
            <TabsTrigger 
              value="guests" 
              className="flex items-center justify-center gap-1 sm:gap-2 h-10 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground data-[state=active]:border-destructive data-[state=active]:shadow-sm hover:bg-muted/50 px-1 sm:px-3"
            >
              <Users className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Gasttabs</span>
            </TabsTrigger>
            <TabsTrigger 
              value="stock" 
              className="flex items-center justify-center gap-1 sm:gap-2 h-10 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground data-[state=active]:border-destructive data-[state=active]:shadow-sm hover:bg-muted/50 px-1 sm:px-3"
            >
              <Package className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Voorraad</span>
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="flex items-center justify-center gap-1 sm:gap-2 h-10 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground data-[state=active]:border-destructive data-[state=active]:shadow-sm hover:bg-muted/50 px-1 sm:px-3"
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger 
              value="notifications" 
              className="flex items-center justify-center gap-1 sm:gap-2 h-10 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground data-[state=active]:border-destructive data-[state=active]:shadow-sm hover:bg-muted/50 px-1 sm:px-3"
            >
              <TrendingUp className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Meldingen</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <InventoryValueDashboard />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="guests">
            <GuestTabManagement />
          </TabsContent>
          
          <TabsContent value="stock" className="space-y-6">
            <ProductManagement />
            <RestockSessions />
            <StockAudits />
          </TabsContent>
          
          <TabsContent value="analytics">
            <SalesDetailsDashboard />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationManagement />
          </TabsContent>
        </Tabs>

        {/* QR Code at bottom */}
        <div className="flex justify-center pt-8">
          <WebsiteQRGenerator />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;