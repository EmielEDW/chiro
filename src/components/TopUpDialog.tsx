import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Banknote, Plus } from 'lucide-react';

interface TopUpDialogProps {
  children: React.ReactNode;
}

const TopUpDialog = ({ children }: TopUpDialogProps) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const quickAmounts = [5, 10, 20, 50];

  const handleTopUp = () => {
    if (!amount || !method) {
      toast({
        title: "Vul alle velden in",
        description: "Selecteer een bedrag en betaalmethode.",
        variant: "destructive",
      });
      return;
    }

    // For now, just show a placeholder message
    toast({
      title: "Betalingsfunctionaliteit",
      description: `€${amount} opladen via ${method} wordt binnenkort toegevoegd!`,
    });
    
    setIsOpen(false);
    setAmount('');
    setMethod('');
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
            <Label>Snel bedrag selecteren</Label>
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

          {/* Custom Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Of voer een eigen bedrag in</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">€</span>
              <Input
                id="amount"
                type="number"
                min="1"
                max="100"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-8"
              />
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
                className={`cursor-pointer transition-colors ${method === 'cash' ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setMethod('cash')}
              >
                <CardContent className="p-3 flex items-center space-x-3">
                  <Banknote className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Cash</p>
                    <p className="text-xs text-muted-foreground">Betaal bij de bar</p>
                  </div>
                  {method === 'cash' && (
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
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
              Annuleren
            </Button>
            <Button onClick={handleTopUp} className="flex-1">
              <Plus className="mr-2 h-4 w-4" />
              Laden
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TopUpDialog;