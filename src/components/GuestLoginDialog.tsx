import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';

interface GuestLoginDialogProps {
  onGuestSelect: (guestId: string, guestName: string) => void;
}

const GuestLoginDialog = ({ onGuestSelect }: GuestLoginDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirmLogin = async () => {
    if (!guestName.trim()) return;

    setIsLoading(true);
    try {
      // Create temporary guest account
      const { data: guestId, error } = await supabase
        .rpc('create_temp_guest_account', { 
          _guest_name: guestName.trim() 
        });

      if (error) throw error;
      if (!guestId) throw new Error('Gastaccount kon niet worden aangemaakt');

      onGuestSelect(guestId, guestName.trim());
      setIsOpen(false);
      setGuestName('');
    } catch (error) {
      console.error('Error creating guest account:', error);
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
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Voer je naam in om als gast in te loggen. Er wordt automatisch een tijdelijk account aangemaakt.
            </p>
            <div>
              <Label htmlFor="guest-name">Je naam</Label>
              <Input
                id="guest-name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Voer je naam in"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && guestName.trim()) {
                    handleConfirmLogin();
                  }
                }}
              />
            </div>
          </div>
          <Button 
            onClick={handleConfirmLogin}
            disabled={!guestName.trim() || isLoading}
            className="w-full"
          >
            {isLoading ? 'Account aanmaken...' : 'Inloggen als Gast'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GuestLoginDialog;