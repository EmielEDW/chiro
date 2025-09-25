import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditCard, User, QrCode, LogOut, Coffee, AlertCircle, CheckCircle, Copy, Smartphone, CreditCardIcon } from 'lucide-react';
import DrinkGrid from '@/components/DrinkGrid';
import GuestHistory from '@/components/GuestHistory';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface GuestProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  guest_account: boolean;
  guest_number: number;
  occupied: boolean;
  occupied_by_name: string | null;
  active: boolean;
}

const Guest = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [guestProfile, setGuestProfile] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);

  const loadGuestProfile = async () => {
    if (!id) return;
    
    try {
      const response = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', id)
        .eq('guest_account', true)
        .eq('occupied', true)
        .eq('active', true)
        .single();
      
      if (response.error) throw response.error;
      setGuestProfile(response.data);
    } catch (error) {
      console.error('Error loading guest profile:', error);
      setGuestProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadBalance = async () => {
    if (!id) return;
    
    try {
      const response = await (supabase as any)
        .rpc('calculate_user_balance', { user_uuid: id });
      
      if (!response.error) {
        setBalance(response.data || 0);
      }
    } catch (error) {
      console.error('Error loading balance:', error);
    }
  };

  const refetchBalance = () => {
    loadBalance();
  };

  useEffect(() => {
    loadGuestProfile();
    loadBalance();
    
    // Set up balance refresh interval
    const balanceInterval = setInterval(loadBalance, 5000);
    return () => clearInterval(balanceInterval);
  }, [id]);

  const handleShowPayment = () => {
    setShowPaymentDialog(true);
  };

  const handleLogout = () => {
    navigate('/auth');
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  // Redirect if guest profile is not valid
  if (!profileLoading && !guestProfile) {
    return <Navigate to="/auth" replace />;
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Gekopieerd!",
        description: "Tekst is naar het klembord gekopieerd.",
      });
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-primary to-primary/80 text-white p-6 pb-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl">
                <Coffee className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Chiro Drinks</h1>
                <p className="text-primary-foreground/80 text-sm">Gastaccount</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-white hover:bg-white/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Uitloggen
            </Button>
          </div>

          {/* Guest Info Card */}
          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full">
                  <User className="h-5 w-5" />
                  <span className="text-xl font-semibold">
                    {guestProfile?.occupied_by_name || guestProfile?.name}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-white/70 mb-1">Huidig Saldo</p>
                    <Badge 
                      variant={balance < 0 ? "destructive" : "secondary"}
                      className={cn(
                        "text-lg px-4 py-2",
                        balance < 0 
                          ? "bg-red-500/20 text-red-100 border-red-300/30" 
                          : "bg-green-500/20 text-green-100 border-green-300/30"
                      )}
                    >
                      {formatCurrency(balance)}
                    </Badge>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-white/70 mb-1">Gast ID</p>
                    <Badge variant="outline" className="bg-white/10 text-white border-white/30">
                      #{guestProfile?.guest_number}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6 -mt-4">
        {/* Quick Payment Status */}
        <Card className={cn(
          "border-2",
          balance < 0 
            ? "border-red-200 bg-red-50/50 dark:bg-red-950/20" 
            : "border-green-200 bg-green-50/50 dark:bg-green-950/20"
        )}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className={cn(
                "p-3 rounded-full",
                balance < 0 
                  ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" 
                  : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              )}>
                {balance < 0 ? <AlertCircle className="h-6 w-6" /> : <CheckCircle className="h-6 w-6" />}
              </div>
              <div className="flex-1">
                {balance < 0 ? (
                  <>
                    <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                      Je hebt een openstaande rekening
                    </h3>
                    <p className="text-red-700 dark:text-red-300 mb-4">
                      Betaal <strong>{formatCurrency(Math.abs(balance))}</strong> om je account af te rekenen
                    </p>
                    <Button 
                      onClick={handleShowPayment}
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                      size="lg"
                    >
                      <CreditCardIcon className="mr-2 h-5 w-5" />
                      Rekening afrekenen
                    </Button>
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                      Geen openstaande rekening
                    </h3>
                    <p className="text-green-700 dark:text-green-300 mb-4">
                      Je staat momenteel {balance === 0 ? 'op nul' : `€${(balance / 100).toFixed(2)} in het groen`}. 
                      Bestel drankjes om je account te gebruiken!
                    </p>
                    <Button 
                      onClick={handleShowPayment}
                      variant="outline"
                      className="w-full border-green-300 text-green-700 hover:bg-green-50"
                      size="lg"
                    >
                      <Smartphone className="mr-2 h-5 w-5" />
                      Bekijk betaalinfo
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Drink Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <Coffee className="h-5 w-5 text-primary" />
              Kies je drankje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DrinkGrid 
              balance={balance} 
              onDrinkLogged={() => {
                refetchBalance();
              }}
              isGuestMode={true}
              guestUserId={id}
            />
          </CardContent>
        </Card>

        {/* Transaction History */}
        <GuestHistory 
          guestUserId={id || ''}
          onBalanceChange={refetchBalance}
        />

        {/* Help Section */}
        <Card className="border-muted">
          <CardContent className="p-6">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 text-muted-foreground">
                <QrCode className="h-4 w-4" />
                <span className="text-sm">
                  Heb je hulp nodig? Toon dit scherm aan de leiding
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Guest ID: <span className="font-mono">{guestProfile?.guest_number}</span> • 
                Account: <span className="font-medium">{guestProfile?.occupied_by_name || guestProfile?.name}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCardIcon className="h-5 w-5 text-primary" />
                Betaalgegevens
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Amount to pay */}
              <div className="text-center p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Te betalen bedrag</p>
                <p className="text-3xl font-bold text-primary">
                  {balance < 0 ? formatCurrency(Math.abs(balance)) : '€0.00'}
                </p>
              </div>

              {/* Payment Details */}
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">Rekeningnummer</p>
                      <p className="font-mono text-lg">BE52 0637 7145 7809</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard('BE52 0637 7145 7809')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm mb-1">Mededeling</p>
                      <p className="font-mono text-sm bg-background px-3 py-2 rounded border break-all">
                        Gastaccount: {guestProfile?.occupied_by_name || guestProfile?.name} (#{guestProfile?.guest_number})
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(`Gastaccount: ${guestProfile?.occupied_by_name || guestProfile?.name} (#${guestProfile?.guest_number})`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Instructions */}
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-full text-sm">
                    <AlertCircle className="h-4 w-4" />
                    Gebruik exact deze mededeling
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dit zorgt ervoor dat je betaling automatisch wordt verwerkt
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Guest;