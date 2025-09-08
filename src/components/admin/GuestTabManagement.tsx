import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, QrCode, CreditCard, Trash2, DollarSign, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'qrcode';

interface GuestAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  guest_account: boolean;
  guest_number: number;
  occupied: boolean;
  occupied_by_name: string | null;
  active: boolean;
  balance: number;
}

const GuestTabManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newGuestName, setNewGuestName] = useState('');
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{ name: string; url: string; balance: number } | null>(null);

  const { data: guestAccounts = [], isLoading } = useQuery({
    queryKey: ['guest-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('guest_account', true)
        .eq('active', true)
        .order('guest_number');
      
      if (error) throw error;

      // Get balances for all guests
      const accountsWithBalances = await Promise.all(
        data.map(async (account) => {
          const { data: balance, error: balanceError } = await supabase
            .rpc('calculate_user_balance', { user_uuid: account.id });
          
          return {
            ...account,
            balance: balanceError ? 0 : (balance || 0)
          };
        })
      );

      return accountsWithBalances;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const createGuestAccount = useMutation({
    mutationFn: async (guestName: string) => {
      const { data, error } = await supabase.functions.invoke('create-temp-guest', {
        body: { guest_name: guestName }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-accounts'] });
      setNewGuestName('');
      toast({
        title: "Gastaccount aangemaakt",
        description: "Nieuw gastaccount is succesvol aangemaakt.",
      });
    },
    onError: () => {
      toast({
        title: "Fout",
        description: "Er ging iets mis bij het aanmaken van het gastaccount.",
        variant: "destructive",
      });
    },
  });

  const settleGuestCash = useMutation({
    mutationFn: async (guestId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-settle-guest', {
        body: { guest_id: guestId, method: 'cash' }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-accounts'] });
      toast({
        title: "Afgerekend",
        description: "Gastaccount is afgerekend met contant geld.",
      });
    },
  });

  const closeGuestTab = useMutation({
    mutationFn: async (guestId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          occupied: false, 
          occupied_by_name: null,
          active: false 
        })
        .eq('id', guestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-accounts'] });
      toast({
        title: "Tab gesloten",
        description: "Gasttab is succesvol gesloten.",
      });
    },
  });

  const deleteGuestAccount = useMutation({
    mutationFn: async (guestId: string) => {
      // First check if there are any consumptions
      const { data: consumptions, error: consumptionsError } = await supabase
        .from('consumptions')
        .select('id')
        .eq('user_id', guestId)
        .limit(1);
      
      if (consumptionsError) throw consumptionsError;
      
      if (consumptions && consumptions.length > 0) {
        throw new Error('Cannot delete guest account with existing consumptions');
      }

      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', guestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-accounts'] });
      toast({
        title: "Account verwijderd",
        description: "Gastaccount is verwijderd.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Kan niet verwijderen",
        description: error.message.includes('consumptions') 
          ? "Kan account met bestaande consumptions niet verwijderen."
          : "Er ging iets mis bij het verwijderen.",
        variant: "destructive",
      });
    },
  });

  const generateQRCode = async (guestId: string, guestName: string, balance: number) => {
    try {
      const guestUrl = `${window.location.origin}/guest/${guestId}`;
      const qrCode = await QRCode.toDataURL(guestUrl);
      setQrCodeData({ name: guestName, url: qrCode, balance });
    } catch (error) {
      toast({
        title: "Fout",
        description: "Kon QR-code niet genereren.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const handleCreateGuest = async () => {
    if (!newGuestName.trim()) return;
    
    setIsCreatingGuest(true);
    try {
      await createGuestAccount.mutateAsync(newGuestName.trim());
    } finally {
      setIsCreatingGuest(false);
    }
  };

  if (isLoading) {
    return <div>Laden...</div>;
  }

  const occupiedGuests = guestAccounts.filter(account => account.occupied);
  const availableGuests = guestAccounts.filter(account => !account.occupied);

  return (
    <div className="space-y-6">
      {/* Create new guest */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nieuw gastaccount
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="guest-name">Naam van de gast</Label>
              <Input
                id="guest-name"
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                placeholder="Bijv. Jan, Marie, ..."
                disabled={isCreatingGuest}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleCreateGuest}
                disabled={!newGuestName.trim() || isCreatingGuest}
              >
                {isCreatingGuest ? 'Bezig...' : 'Aanmaken'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active guest tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Actieve gasttabs ({occupiedGuests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {occupiedGuests.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Geen actieve gasttabs
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gast</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {occupiedGuests.map((guest) => (
                  <TableRow key={guest.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{guest.occupied_by_name}</div>
                        <div className="text-sm text-muted-foreground">
                          Gast #{guest.guest_number}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={guest.balance < 0 ? "destructive" : "default"}
                      >
                        {formatCurrency(guest.balance)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateQRCode(guest.id, guest.occupied_by_name || guest.name, guest.balance)}
                        >
                          <QrCode className="h-3 w-3" />
                        </Button>
                        {guest.balance < 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => settleGuestCash.mutate(guest.id)}
                          >
                            <DollarSign className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => closeGuestTab.mutate(guest.id)}
                        >
                          Sluiten
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Available guest accounts */}
      {availableGuests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Beschikbare gastaccounts ({availableGuests.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableGuests.map((guest) => (
                  <TableRow key={guest.id}>
                    <TableCell>Gast #{guest.guest_number}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {formatCurrency(guest.balance)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteGuestAccount.mutate(guest.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* QR Code Dialog */}
      <Dialog open={!!qrCodeData} onOpenChange={() => setQrCodeData(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR-code voor {qrCodeData?.name}</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            {qrCodeData && (
              <>
                <img 
                  src={qrCodeData.url} 
                  alt="QR Code" 
                  className="mx-auto w-48 h-48"
                />
                <div className="space-y-2">
                  <Badge 
                    variant={qrCodeData.balance < 0 ? "destructive" : "default"}
                    className="text-lg px-4 py-2"
                  >
                    {formatCurrency(qrCodeData.balance)}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Laat de gast deze QR-code scannen
                  </p>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GuestTabManagement;