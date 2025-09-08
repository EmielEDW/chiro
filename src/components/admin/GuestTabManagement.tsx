import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, QrCode, Trash2, DollarSign, Users } from 'lucide-react';
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
  const [newGuestName, setNewGuestName] = useState('');
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{ name: string; url: string; balance: number } | null>(null);

  // Fetch active guest accounts
  const [guestAccounts, setGuestAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadGuestAccounts = async () => {
    try {
      const response = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('guest_account', true)
        .eq('active', true)
        .order('guest_number');
      
      if (response.error) throw response.error;

      // Get balances for all guests
      const accountsWithBalances = await Promise.all(
        (response.data as any[]).map(async (account: any) => {
          const balanceResponse = await (supabase as any)
            .rpc('calculate_user_balance', { user_uuid: account.id });
          
          return {
            ...account,
            balance: balanceResponse.error ? 0 : (balanceResponse.data || 0)
          };
        })
      );

      setGuestAccounts(accountsWithBalances);
    } catch (error) {
      console.error('Error loading guest accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load on mount and set up periodic refresh
  useEffect(() => {
    loadGuestAccounts();
    const interval = setInterval(loadGuestAccounts, 10000);
    return () => clearInterval(interval);
  }, []);

  // Test function to check if the database function exists
  const testDatabaseFunction = async () => {
    try {
      const { data, error } = await (supabase as any)
        .rpc('create_temp_guest_account', { _guest_name: 'Test User' });
      
      console.log('Database function test result:', { data, error });
      
      if (error) {
        console.error('Database function error:', error);
        toast({
          title: "Database Function Error",
          description: `Database function failed: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log('Database function works, guest ID:', data);
      }
    } catch (err) {
      console.error('Database function test failed:', err);
    }
  };

  // Add test button to check database function (temporary for debugging)
  const handleTestFunction = () => {
    testDatabaseFunction();
  };

  const createGuestAccount = async (guestName: string) => {
    try {
      console.log('Creating guest account for:', guestName);
      const { data, error } = await (supabase as any).functions.invoke('create-temp-guest', {
        body: { guest_name: guestName }
      });
      
      console.log('Edge function response:', { data, error });
      
      if (error) throw error;

      loadGuestAccounts();
      setNewGuestName('');
      toast({
        title: "Gastaccount aangemaakt",
        description: "Nieuw gastaccount is succesvol aangemaakt.",
      });
    } catch (error) {
      console.error('Create guest account error:', error);
      toast({
        title: "Fout",
        description: `Er ging iets mis bij het aanmaken van het gastaccount: ${error.message || error}`,
        variant: "destructive",
      });
    }
  };

  const settleGuestCash = async (guestId: string) => {
    try {
      const { data, error } = await (supabase as any).functions.invoke('admin-settle-guest', {
        body: { guest_id: guestId, method: 'cash' }
      });
      
      if (error) throw error;

      loadGuestAccounts();
      toast({
        title: "Afgerekend",
        description: "Gastaccount is afgerekend met contant geld.",
      });
    } catch (error) {
      toast({
        title: "Fout",
        description: "Er ging iets mis bij het afrekenen.",
        variant: "destructive",
      });
    }
  };

  const closeGuestTab = async (guestId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ 
          occupied: false, 
          occupied_by_name: null,
          active: false 
        })
        .eq('id', guestId);
      
      if (error) throw error;

      loadGuestAccounts();
      toast({
        title: "Tab gesloten",
        description: "Gasttab is succesvol gesloten.",
      });
    } catch (error) {
      toast({
        title: "Fout",
        description: "Er ging iets mis bij het sluiten van de tab.",
        variant: "destructive",
      });
    }
  };

  const deleteGuestAccount = async (guestId: string) => {
    try {
      // First check if there are any consumptions
      const { data: consumptions, error: consumptionsError } = await (supabase as any)
        .from('consumptions')
        .select('id')
        .eq('user_id', guestId)
        .limit(1);
      
      if (consumptionsError) throw consumptionsError;
      
      if (consumptions && consumptions.length > 0) {
        throw new Error('Cannot delete guest account with existing consumptions');
      }

      const { error } = await (supabase as any)
        .from('profiles')
        .delete()
        .eq('id', guestId);
      
      if (error) throw error;

      loadGuestAccounts();
      toast({
        title: "Account verwijderd",
        description: "Gastaccount is verwijderd.",
      });
    } catch (error: any) {
      toast({
        title: "Kan niet verwijderen",
        description: error.message.includes('consumptions') 
          ? "Kan account met bestaande consumptions niet verwijderen."
          : "Er ging iets mis bij het verwijderen.",
        variant: "destructive",
      });
    }
  };

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
      await createGuestAccount(newGuestName.trim());
    } finally {
      setIsCreatingGuest(false);
    }
  };

  if (isLoading) {
    return <div>Laden...</div>;
  }

  const occupiedGuests = guestAccounts.filter((account: any) => account.occupied);
  const availableGuests = guestAccounts.filter((account: any) => !account.occupied);

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
            <div className="flex items-end gap-2">
              <Button 
                onClick={handleCreateGuest}
                disabled={!newGuestName.trim() || isCreatingGuest}
              >
                {isCreatingGuest ? 'Bezig...' : 'Aanmaken'}
              </Button>
              <Button 
                onClick={handleTestFunction}
                variant="outline"
                size="sm"
              >
                Test DB
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
                {occupiedGuests.map((guest: any) => (
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
                            onClick={() => settleGuestCash(guest.id)}
                          >
                            <DollarSign className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => closeGuestTab(guest.id)}
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
                {availableGuests.map((guest: any) => (
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
                        onClick={() => deleteGuestAccount(guest.id)}
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