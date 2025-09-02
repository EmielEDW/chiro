import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Clock } from 'lucide-react';

interface LateFeeDialogProps {
  onLateFeeProcessed: () => void;
  children?: React.ReactNode;
}

const LateFeeDialog = ({ onLateFeeProcessed, children }: LateFeeDialogProps) => {
  const [minutes, setMinutes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const calculateLateFee = (minutesLate: number): number => {
    if (minutesLate <= 0) return 0;
    // 1-4 min -> €1, every next full 5 min adds €1, capped at €5
    const euros = Math.min(Math.floor(minutesLate / 5) + 1, 5);
    return euros * 100;
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    
    const minutesLate = parseInt(minutes);
    if (isNaN(minutesLate) || minutesLate <= 0) {
      toast({
        title: "Ongeldige invoer",
        description: "Voer een geldig aantal minuten in.",
        variant: "destructive",
      });
      return;
    }

    const feeInCents = calculateLateFee(minutesLate);
    
    setIsProcessing(true);
    
    try {
      // Ensure the special fee item exists
      const { data: feeItem, error: feeFetchError } = await supabase
        .from('items')
        .select('id')
        .eq('name', 'Te laat boete')
        .limit(1)
        .maybeSingle();

      let feeItemId = feeItem?.id as string | undefined;

      if (!feeItemId) {
        // Fetch the current user's role
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        const role = myProfile?.role;

        if (role !== 'admin') {
          toast({
            title: 'Boete item ontbreekt',
            description: 'Contacteer een admin om het item "Te laat boete" aan te maken.',
            variant: 'destructive',
          });
          return;
        }

        // Create the fee item (admin only)
        const { data: created, error: createErr } = await supabase
          .from('items')
          .insert({
            name: 'Te laat boete',
            price_cents: 0,
            active: true,
            is_default: false, // hide from regular grid
            category: 'andere',
            description: 'Boete bij te laat komen',
          })
          .select('id')
          .single();

        if (createErr) throw createErr;
        feeItemId = created?.id;
      }

      if (!feeItemId) throw new Error('Fee item kon niet worden bepaald.');

      // Create a consumption record for the late fee
      const { error } = await supabase
        .from('consumptions')
        .insert({
          user_id: user.id,
          item_id: feeItemId,
          price_cents: feeInCents,
          source: 'tap',
          note: `Te laat: ${minutesLate} minuten`,
        });

      if (error) throw error;

      toast({
        title: "Te laat boete verwerkt",
        description: `${formatCurrency(feeInCents)} afgetrokken voor ${minutesLate} minuten te laat.`,
      });

      setIsOpen(false);
      setMinutes('');
      onLateFeeProcessed();
    } catch (error) {
      console.error('Error processing late fee:', error);
      toast({
        title: "Fout bij verwerking",
        description: "Er ging iets mis bij het verwerken van de boete.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="flex-col h-16 space-y-1">
            <Clock className="h-5 w-5" />
            <span className="text-sm">Te laat</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Te laat boete</DialogTitle>
          <DialogDescription>Voer het aantal minuten te laat in en bevestig.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">Ben je te laat? Hoeveel minuten was je te laat?</p>
            <div className="bg-muted/50 p-3 rounded-md text-xs">
              <p className="font-medium mb-1">Tarieven:</p>
              <ul className="space-y-1">
                <li>• Eerste minuut te laat: €1,00</li>
                <li>• Elke 5 minuten extra: +€1,00</li>
                <li>• Maximum: €5,00</li>
              </ul>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="minutes">Aantal minuten te laat</Label>
            <Input
              id="minutes"
              type="number"
              min="1"
              max="60"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="bijv. 10"
            />
          </div>

          {minutes && parseInt(minutes) > 0 && (
            <div className="bg-primary/10 p-3 rounded-md">
              <p className="text-sm font-medium">
                Boete: {formatCurrency(calculateLateFee(parseInt(minutes)))}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Annuleren
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!minutes || isProcessing}
              className="flex-1"
            >
              {isProcessing ? 'Verwerken...' : 'Boete toepassen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LateFeeDialog;