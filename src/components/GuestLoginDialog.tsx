import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface GuestProfile {
  id: string;
  name: string;
  guest_account: boolean;
}

interface GuestLoginDialogProps {
  onGuestSelect: (guestId: string, guestName: string) => void;
}

const GuestLoginDialog = ({ onGuestSelect }: GuestLoginDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const { data: guestAccounts = [], isLoading } = useQuery({
    queryKey: ['available-guests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, guest_account')
        .eq('guest_account', true)
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data as GuestProfile[];
    },
    enabled: isOpen,
  });

  const handleGuestSelect = (guest: GuestProfile) => {
    onGuestSelect(guest.id, guest.name);
    setIsOpen(false);
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
          <DialogTitle>Selecteer Gast Account</DialogTitle>
        </DialogHeader>
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
                        {guest.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">{guest.name}</div>
                      <Badge variant="secondary" className="text-xs">Gast Account</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GuestLoginDialog;