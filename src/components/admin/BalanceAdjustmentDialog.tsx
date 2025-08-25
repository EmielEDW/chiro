import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CreditCard } from 'lucide-react';

interface BalanceAdjustmentDialogProps {
  userId: string;
  userName: string;
  currentBalance: number;
}

const BalanceAdjustmentDialog = ({ userId, userName, currentBalance }: BalanceAdjustmentDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [reason, setReason] = useState('');

  const createAdjustment = useMutation({
    mutationFn: async ({ deltaCents, adjustmentReason }: { deltaCents: number; adjustmentReason: string }) => {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user?.id) throw new Error('Niet geautoriseerd');

      const { data, error } = await supabase
        .from('adjustments')
        .insert({
          user_id: userId,
          delta_cents: deltaCents,
          reason: adjustmentReason,
          created_by: currentUser.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-balances'] });
      toast({
        title: 'Saldo aangepast',
        description: `Het saldo van ${userName} is succesvol aangepast.`,
      });
      setIsOpen(false);
      setAdjustmentAmount('');
      setReason('');
    },
    onError: (error: any) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const deltaCents = Math.round(parseFloat(adjustmentAmount) * 100);
    
    if (isNaN(deltaCents) || deltaCents === 0) {
      toast({
        title: 'Ongeldig bedrag',
        description: 'Voer een geldig bedrag in.',
        variant: 'destructive',
      });
      return;
    }

    if (!reason.trim()) {
      toast({
        title: 'Reden vereist',
        description: 'Voer een reden in voor de aanpassing.',
        variant: 'destructive',
      });
      return;
    }

    createAdjustment.mutate({ deltaCents, adjustmentReason: reason.trim() });
  };

  const formatCurrency = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Saldo aanpassen">
          <CreditCard className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saldo aanpassen - {userName}</DialogTitle>
          <DialogDescription>
            Pas het saldo van deze gebruiker aan. Positieve bedragen verhogen het saldo, negatieve bedragen verlagen het.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">Huidig saldo: {formatCurrency(currentBalance)}</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="adjustment">Aanpassing (€)</Label>
              <Input
                id="adjustment"
                type="number"
                step="0.01"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                placeholder="Bijv. 10.00 of -5.50"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Gebruik een minteken (-) om geld af te trekken
              </p>
            </div>
            
            <div>
              <Label htmlFor="reason">Reden voor aanpassing</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Bijv. Correctie foutieve transactie, handmatige top-up..."
                required
                rows={3}
              />
            </div>
            
            {adjustmentAmount && !isNaN(parseFloat(adjustmentAmount)) && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Nieuw saldo wordt:</strong>{' '}
                  {formatCurrency(currentBalance + Math.round(parseFloat(adjustmentAmount) * 100))}
                </p>
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Annuleren
              </Button>
              <Button
                type="submit"
                disabled={createAdjustment.isPending}
              >
                Saldo aanpassen
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BalanceAdjustmentDialog;