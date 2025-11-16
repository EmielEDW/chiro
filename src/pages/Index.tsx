import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import BalanceCard from '@/components/BalanceCard';
import DrinkGrid from '@/components/DrinkGrid';
import TopUpDialog from '@/components/TopUpDialog';
import MobileCategoryFilter from '@/components/MobileCategoryFilter';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { LogOut, History, Settings, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';

const Index = () => {
  const { user } = useAuth();
  const { profile, balance, isLoading, refreshBalance } = useProfile();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [selectedCategory, setSelectedCategory] = useState<string>('');

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

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="text-center space-y-4">
          <img 
            src="/lovable-uploads/11df38ab-3cdc-4bfc-8e71-a51ec8bef666.png" 
            alt="Chiro Logo" 
            className="h-16 w-16 mx-auto"
          />
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b" id="main-header">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img 
                src="/lovable-uploads/11df38ab-3cdc-4bfc-8e71-a51ec8bef666.png" 
                alt="Chiro Logo" 
                className="h-8 w-8"
              />
              <h1 className="text-xl font-bold text-primary">Chiro Bar</h1>
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
        {/* Balance Card */}
        <TopUpDialog>
          <div className="w-full">
            <BalanceCard 
              balance={balance} 
              onTopUp={() => {}}
            />
          </div>
        </TopUpDialog>

        {/* Quick Actions - Only show on desktop */}
        {!isMobile && (
          <Button 
            variant="outline" 
            className="h-16 flex-col space-y-1"
            onClick={() => navigate('/history')}
          >
            <History className="h-5 w-5" />
            <span className="text-sm">Geschiedenis</span>
          </Button>
        )}

        {/* Mobile Category Filter */}
        <MobileCategoryFilter 
          onCategorySelect={setSelectedCategory}
          selectedCategory={selectedCategory}
        />

        {/* Drinks Grid */}
        <DrinkGrid 
          balance={balance}
          onDrinkLogged={handleRefreshBalance}
        />
      </main>
      
      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
          <div className="grid grid-cols-2 gap-1 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-col h-16 space-y-1"
              onClick={() => navigate('/history')}
            >
              <History className="h-5 w-5" />
              <span className="text-xs">Geschiedenis</span>
            </Button>
            
            <TopUpDialog>
              <Button
                variant="ghost"
                size="sm"
                className="flex-col h-16 space-y-1"
              >
                <CreditCard className="h-5 w-5" />
                <span className="text-xs">Opladen</span>
              </Button>
            </TopUpDialog>
          </div>
        </div>
      )}
      
      {/* Add bottom padding on mobile to prevent content from being hidden behind the bottom bar */}
      {isMobile && <div className="h-20"></div>}
    </div>
  );
};

export default Index;
