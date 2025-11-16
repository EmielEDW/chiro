import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Building2, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';

interface TopUpDialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialAmount?: number;
}

const TopUpDialog = ({ children, open: externalOpen, onOpenChange, initialAmount }: TopUpDialogProps) => {
  const [amount, setAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [method, setMethod] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { refreshBalance, profile } = useProfile();

  // Use external open state if provided, otherwise use internal state
  const dialogOpen = externalOpen !== undefined ? externalOpen : isOpen;
  const setDialogOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setIsOpen(open);
    }
  };

  // Set initial amount when provided
  useEffect(() => {
    if (initialAmount && dialogOpen) {
      setCustomAmount(initialAmount.toString());
    }
  }, [initialAmount, dialogOpen]);

  const quickAmounts = [25, 50];
  
  const getCurrentAmount = () => {
    return customAmount || amount;
  };
  
  const getCurrentAmountNumber = () => {
    const currentAmount = getCurrentAmount();
    return currentAmount ? parseFloat(currentAmount) : 0;
  };
  
  const isAmountTooLow = () => {
    return getCurrentAmountNumber() < 25;
  };

  const handleTopUp = async () => {
    const currentAmount = getCurrentAmount();
    if (!currentAmount || !method) {
      toast({
        title: "Vul alle velden in",
        description: "Selecteer een bedrag en betaalmethode.",
        variant: "destructive",
      });
      return;
    }

    const numAmount = parseFloat(currentAmount);
    if (numAmount <= 0) {
      toast({
        title: "Ongeldig bedrag",
        description: "Voer een geldig bedrag in dat groter is dan €0.",
        variant: "destructive",
      });
      return;
    }

    if (numAmount < 25 && method === 'bancontact') {
      toast({
        title: "Bedrag te laag voor Bancontact",
        description: "Voor bedragen onder €25 kan alleen bankoverschrijving gebruikt worden.",
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
        setDialogOpen(false);
        setAmount('');
        setCustomAmount('');
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
        
        setDialogOpen(false);
        setAmount('');
        setCustomAmount('');
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
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                  variant={amount === quickAmount.toString() && !customAmount ? "default" : "outline"}
                  onClick={() => {
                    setAmount(quickAmount.toString());
                    setCustomAmount('');
                  }}
                  className="h-12"
                >
                  €{quickAmount}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-amount">Of voer een aangepast bedrag in</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">€</span>
                <Input
                  id="custom-amount"
                  type="number"
                  placeholder="0.00"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setAmount('');
                  }}
                  className="pl-8"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-3">
            <Label>Betaalmethode</Label>
            <div className="grid gap-2">
              <Card 
                className={`cursor-pointer transition-colors ${
                  method === 'bancontact' ? 'ring-2 ring-primary' : ''
                } ${isAmountTooLow() ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => !isAmountTooLow() && setMethod('bancontact')}
              >
                <CardContent className="p-3 flex items-center space-x-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">Bancontact</p>
                      <Badge variant="preferred" className="text-xs">
                        Preferred method
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Betaal met je bankkaart</p>
                    {isAmountTooLow() && (
                      <p className="text-xs text-destructive mt-1">Minimaal €25 voor Bancontact</p>
                    )}
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
                    <p className="text-xs text-muted-foreground mt-1">Voor opladingen kleiner dan €25</p>
                  </div>
                  {method === 'banktransfer' && (
                    <Badge variant="default" className="text-xs">Geselecteerd</Badge>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Summary */}
          {getCurrentAmount() && method && (
            <Card className="bg-muted/50">
              <CardContent className="p-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Totaal op te laden:</span>
                  <span className="text-lg font-bold text-primary">€{getCurrentAmount()}</span>
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