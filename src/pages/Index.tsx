import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import BalanceCard from '@/components/BalanceCard';
import DrinkGrid from '@/components/DrinkGrid';
import ConsumptionHistory from '@/components/ConsumptionHistory';
import Leaderboard from '@/components/Leaderboard';
import TopUpDialog from '@/components/TopUpDialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { LogOut, History, Settings, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { user } = useAuth();
  const { profile, balance, isLoading, refreshBalance } = useProfile();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Fout bij uitloggen",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRefreshBalance = () => {
    refreshBalance();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img 
                src="/lovable-uploads/11df38ab-3cdc-4bfc-8e71-a51ec8bef666.png" 
                alt="Chiro Logo" 
                className="h-8 w-8"
              />
              <h1 className="text-xl font-bold text-primary">Chiro Drinks</h1>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  {profile?.avatar_url && (
                    <img 
                      src={profile.avatar_url} 
                      alt="Profile" 
                      className="h-full w-full object-cover rounded-full"
                    />
                  )}
                  <AvatarFallback>
                    {profile?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium">{profile?.name || 'Gebruiker'}</p>
                  <p className="text-xs text-muted-foreground">{profile?.chiro_role || 'Lid'}</p>
                </div>
              </div>
              
              {profile?.role === 'admin' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin')}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/settings')}
              >
                <Eye className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Greeting */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">
            Hallo, {profile?.name?.split(' ')[0] || 'daar'}! 👋
          </h2>
          <p className="text-muted-foreground">
            Welkom terug bij je digitale drankkaart
          </p>
        </div>

        {/* Balance Card */}
        <TopUpDialog>
          <div className="w-full">
            <BalanceCard 
              balance={balance} 
              onTopUp={() => {}}
              allowCredit={profile?.allow_credit || false}
            />
          </div>
        </TopUpDialog>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 gap-4">
          <Button 
            variant="outline" 
            className="h-16 flex-col space-y-1"
            onClick={() => navigate('/history')}
          >
            <History className="h-5 w-5" />
            <span className="text-sm">Geschiedenis</span>
          </Button>
        </div>

        {/* Drinks Grid */}
        <DrinkGrid 
          balance={balance}
          allowCredit={profile?.allow_credit || false}
          onDrinkLogged={handleRefreshBalance}
        />

        {/* Recent Activity */}
        <ConsumptionHistory />
        
        {/* Leaderboard */}
        <Leaderboard />
      </main>
    </div>
  );
};

export default Index;
