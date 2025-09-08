import { useParams, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, User, QrCode } from 'lucide-react';
import DrinkGrid from '@/components/DrinkGrid';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
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

  const handlePayment = async () => {
    if (!id || balance >= 0) return;
    
    setIsProcessingPayment(true);
    try {
      const { data, error } = await (supabase as any).functions.invoke('create-guest-payment', {
        body: { guest_id: id }
      });

      if (error) throw error;

      // Open Stripe checkout in new tab
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Fout bij betaling",
        description: "Er ging iets mis bij het openen van de betaling. Probeer opnieuw.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingPayment(false);
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <User className="h-6 w-6 text-primary" />
              <CardTitle className="text-xl">Gasttabblad</CardTitle>
            </div>
            <div className="space-y-2">
              <Badge variant="outline" className="text-lg px-4 py-2">
                {guestProfile?.occupied_by_name || guestProfile?.name}
              </Badge>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-muted-foreground">Saldo:</span>
                <Badge 
                  variant={balance < 0 ? "destructive" : "default"}
                  className="text-lg px-3 py-1"
                >
                  {formatCurrency(balance)}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Payment section - only show if balance is negative */}
        {balance < 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="p-4">
              <div className="text-center space-y-3">
                <h3 className="font-semibold text-amber-800">Rekening afrekenen</h3>
                <p className="text-sm text-amber-700">
                  Je hebt een openstaand bedrag van <strong>{formatCurrency(Math.abs(balance))}</strong>
                </p>
                <Button 
                  onClick={handlePayment}
                  disabled={isProcessingPayment}
                  className="w-full"
                  size="lg"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {isProcessingPayment ? 'Bezig...' : 'Betaal nu'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Drink Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-center">Kies je drankje</h2>
          <DrinkGrid 
            balance={balance} 
            onDrinkLogged={() => {
              refetchBalance();
            }}
          />
        </div>

        {/* Footer */}
        <Card className="border-muted">
          <CardContent className="p-4">
            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                Problemen? Vraag hulp aan de leiding
              </p>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <QrCode className="h-3 w-3" />
                <span>Guest ID: {guestProfile?.guest_number}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Guest;