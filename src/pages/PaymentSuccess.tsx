import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Home, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const { refreshBalance } = useProfile();

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setIsVerifying(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { session_id: sessionId }
        });

        if (error) throw error;
        
        setVerificationResult(data);
        
        // Refresh balance if payment was successful
        if (data.success) {
          refreshBalance();
        }
      } catch (error) {
        console.error('Payment verification failed:', error);
        setVerificationResult({ success: false, error: error.message });
      } finally {
        setIsVerifying(false);
      }
    };

    verifyPayment();
  }, [sessionId, refreshBalance]);

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <RefreshCw className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
            <h2 className="text-xl font-semibold mb-2">Betaling verifiëren...</h2>
            <p className="text-muted-foreground">Even geduld terwijl we je betaling controleren.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSuccess = verificationResult?.success;
  const amount = verificationResult?.amount ? (verificationResult.amount / 100).toFixed(2) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {isSuccess ? (
              <CheckCircle className="h-16 w-16 text-green-500" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-500 text-2xl">✗</span>
              </div>
            )}
          </div>
          <CardTitle className="text-2xl">
            {isSuccess ? 'Betaling Geslaagd!' : 'Betaling Mislukt'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {isSuccess ? (
            <>
              <p className="text-muted-foreground">
                Je saldo is succesvol opgeladen.
              </p>
              {amount && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="font-semibold text-green-800">
                    €{amount} toegevoegd aan je saldo
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">
              Er is een probleem opgetreden bij het verwerken van je betaling. 
              Probeer het opnieuw of neem contact op met de bar.
            </p>
          )}

          <div className="pt-4">
            <Button asChild className="w-full">
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Terug naar Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;