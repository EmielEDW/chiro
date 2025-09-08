import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface GuestLoginDialogProps {
  onGuestSelect: (guestId: string, guestName: string) => void;
}

const GuestLoginDialog = ({ onGuestSelect }: GuestLoginDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [lastGuest, setLastGuest] = useState<{ id: string; display: string; name: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const raw = localStorage.getItem('lastGuest');
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { id: string; name: string };
      (async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, occupied, guest_account, occupied_by_name, guest_number')
          .eq('id', saved.id)
          .maybeSingle();
        if (!error && data && data.guest_account && data.occupied) {
          const display = `${data.name}${data.occupied_by_name ? ` – ${data.occupied_by_name}` : ''}`;
          setLastGuest({ id: data.id, display, name: data.occupied_by_name || saved.name });
        } else {
          setLastGuest(null);
        }
      })();
    } catch (e) {
      setLastGuest(null);
    }
  }, [isOpen]);

  const handleLogin = async () => {
    if (!guestName.trim()) return;

    setIsLoading(true);
    try {
      // Create a new temporary guest account
      const { data: guestId, error } = await supabase
        .rpc('create_temp_guest_account', { 
          _guest_name: guestName.trim() 
        });

      if (error) throw error;
      if (!guestId) throw new Error('Temp account kon niet worden aangemaakt');

      onGuestSelect(guestId, guestName.trim());
      setIsOpen(false);
      setGuestName('');
      
      toast({
        title: "Welkom!",
        description: `Je bent ingelogd als ${guestName.trim()}. Je account is tijdelijk en wordt beheerd door de admin.`,
      });
    } catch (error) {
      console.error('Error creating temp guest account:', error);
      toast({
        title: "Fout",
        description: "Er ging iets mis bij het aanmaken van je gastaccount. Probeer opnieuw.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Users className="h-4 w-4 mr-2" />
          Inloggen als Gast
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Inloggen als Gast</DialogTitle>
          <DialogDescription>
            Maak snel een tijdelijk account aan of log terug in op je vorige gastaccount.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {lastGuest && (
            <div className="rounded-md border p-3 bg-muted/30">
              <p className="text-sm font-medium">Ben jij dit?</p>
              <p className="text-sm text-muted-foreground mb-2">{lastGuest.display}</p>
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    onGuestSelect(lastGuest.id, lastGuest.name);
                    setIsOpen(false);
                  }}
                  className="flex-1"
                >
                  Ja, log mij in
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    localStorage.removeItem('lastGuest');
                    setLastGuest(null);
                  }}
                  className="flex-1"
                >
                  Nee
                </Button>
              </div>
            </div>
          )}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Voer je naam in om een tijdelijk gastaccount aan te maken. Je kunt drankjes kopen en in de min gaan.
            </p>
            <div>
              <Label htmlFor="guest-name">Je naam</Label>
              <Input
                id="guest-name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Voer je naam in"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && guestName.trim() && !isLoading) {
                    handleLogin();
                  }
                }}
              />
            </div>
          </div>
          <Button 
            onClick={handleLogin}
            disabled={!guestName.trim() || isLoading}
            className="w-full"
          >
            {isLoading ? 'Bezig...' : 'Tijdelijk Account Aanmaken'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GuestLoginDialog;