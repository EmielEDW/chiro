import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Building2, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';

interface TopUpDialogProps {
  children: React.ReactNode;
}

const TopUpDialog = ({ children }: TopUpDialogProps) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { refreshBalance, profile } = useProfile();

  const quickAmounts = [25, 50];

  const handleTopUp = async () => {
    if (!amount || !method) {
      toast({
        title: "Vul alle velden in",
        description: "Selecteer een bedrag en betaalmethode.",
        variant: "destructive",
      });
      return;
    }

    const numAmount = parseFloat(amount);
    if (numAmount !== 25 && numAmount !== 50) {
      toast({
        title: "Ongeldig bedrag",
        description: "Selecteer €25 of €50.",
        variant: "destructive",
      });
      return;
    }

    if (method === 'banktransfer') {
      toast({
        title: "Bankoverschrijving",
        description: "Maak een overschrijving naar het opgegeven rekeningnummer. Je saldo wordt handmatig bijgewerkt door de admin.",
        duration: 8000,
      });
      setIsOpen(false);
      setAmount('');
      setMethod('');
      return;
    }

    // Handle Stripe payment
    if (method === 'bancontact') {
      setIsProcessing(true);
      try {
        const { data, error } = await supabase.functions.invoke('create-payment', {
          body: { amount: numAmount }
        });

        if (error) throw error;

        // Redirect to Stripe checkout in same tab
        window.location.href = data.url;
        
        setIsOpen(false);
        setAmount('');
        setMethod('');
        
        toast({
          title: "Betaling gestart",
          description: "Je wordt doorgestuurd naar Stripe om de betaling te voltooien.",
        });
      } catch (error) {
        console.error('Payment error:', error);
        toast({
          title: "Betalingsfout",
          description: "Er is iets misgegaan. Probeer het opnieuw.",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Saldo Opladen</DialogTitle>
          <DialogDescription>
            Kies een bedrag en betaalmethode om je saldo op te laden.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Quick Amount Selection */}
          <div className="space-y-3">
            <Label>Bedrag selecteren</Label>
            <div className="grid grid-cols-2 gap-2">
              {quickAmounts.map((quickAmount) => (
                <Button
                  key={quickAmount}
                  variant={amount === quickAmount.toString() ? "default" : "outline"}
                  onClick={() => setAmount(quickAmount.toString())}
                  className="h-12"
                >
                  €{quickAmount}
                </Button>
              ))}
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-3">
            <Label>Betaalmethode</Label>
            <div className="grid gap-2">
              <Card 
                className={`cursor-pointer transition-colors ${method === 'bancontact' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setMethod('bancontact')}
              >
                <CardContent className="p-3 flex items-center space-x-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Bancontact</p>
                    <p className="text-xs text-muted-foreground">Betaal met je bankkaart</p>
                  </div>
                  {method === 'bancontact' && (
                    <Badge variant="default" className="text-xs">Geselecteerd</Badge>
                  )}
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer transition-colors ${method === 'banktransfer' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setMethod('banktransfer')}
              >
                <CardContent className="p-3 flex items-center space-x-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Bankoverschrijving</p>
                    <p className="text-xs text-muted-foreground">BE52 0637 7145 7809</p>
                  </div>
                  {method === 'banktransfer' && (
                    <Badge variant="default" className="text-xs">Geselecteerd</Badge>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Summary */}
          {amount && method && (
            <Card className="bg-muted/50">
              <CardContent className="p-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Totaal op te laden:</span>
                  <span className="text-lg font-bold text-primary">€{amount}</span>
                </div>
                {method === 'banktransfer' && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <p><strong>Rekeningnummer:</strong> BE52 0637 7145 7809</p>
                    <p><strong>Mededeling:</strong> Opladen dranksaldo {profile?.name || 'onbekend'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
              Annuleren
            </Button>
            <Button onClick={handleTopUp} disabled={isProcessing} className="flex-1">
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {isProcessing ? 'Laden...' : 'Laden'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TopUpDialog;