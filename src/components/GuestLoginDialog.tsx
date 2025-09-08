import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';

interface GuestProfile {
  id: string;
  name: string;
  guest_account: boolean;
  guest_number: number;
  occupied: boolean;
  occupied_by_name?: string;
}

interface GuestLoginDialogProps {
  onGuestSelect: (guestId: string, guestName: string) => void;
}

const GuestLoginDialog = ({ onGuestSelect }: GuestLoginDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<GuestProfile | null>(null);
  const [guestName, setGuestName] = useState('');

  const { data: guestAccounts = [], isLoading } = useQuery({
    queryKey: ['available-guests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, guest_account, guest_number, occupied, occupied_by_name')
        .eq('guest_account', true)
        .eq('active', true)
        .eq('occupied', false)
        .order('guest_number');
      
      if (error) throw error;
      return data as GuestProfile[];
    },
    enabled: isOpen,
  });

  const handleGuestSelect = (guest: GuestProfile) => {
    setSelectedGuest(guest);
  };

  const handleConfirmLogin = async () => {
    if (!selectedGuest || !guestName.trim()) return;

    try {
      // Occupy the guest account
      const { data, error } = await supabase
        .rpc('occupy_guest_account', { 
          _guest_id: selectedGuest.id, 
          _guest_name: guestName.trim() 
        });

      if (error) throw error;
      if (!data) throw new Error('Account kon niet worden bezet');

      onGuestSelect(selectedGuest.id, guestName.trim());
      setIsOpen(false);
      setSelectedGuest(null);
      setGuestName('');
    } catch (error) {
      console.error('Error occupying guest account:', error);
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
          <DialogTitle>
            {selectedGuest ? 'Voer je naam in' : 'Selecteer Gast Account'}
          </DialogTitle>
        </DialogHeader>
        
        {selectedGuest ? (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Je hebt {selectedGuest.name} geselecteerd
              </p>
              <div>
                <Label htmlFor="guest-name">Je naam</Label>
                <Input
                  id="guest-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Voer je naam in"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedGuest(null);
                  setGuestName('');
                }}
                className="flex-1"
              >
                Terug
              </Button>
              <Button 
                onClick={handleConfirmLogin}
                disabled={!guestName.trim()}
                className="flex-1"
              >
                Inloggen
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">Laden...</div>
            ) : guestAccounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Geen gast accounts beschikbaar
              </div>
            ) : (
              <div className="space-y-2">
                {guestAccounts.map((guest) => (
                  <Card key={guest.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleGuestSelect(guest)}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {guest.guest_number}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-medium">{guest.name}</div>
                        <Badge variant="secondary" className="text-xs">Beschikbaar</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GuestLoginDialog;