import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, CreditCard, Trash2 } from 'lucide-react';

interface GuestProfile {
  id: string;
  name: string;
  guest_account: boolean;
  allow_credit: boolean;
  created_at: string;
  guest_number: number;
  occupied: boolean;
  occupied_by_name?: string;
}

const GuestAccountManager = () => {
  const [guestNumber, setGuestNumber] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: guestAccounts = [], isLoading } = useQuery({
    queryKey: ['guest-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('guest_account', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as GuestProfile[];
    },
  });

  const { data: balances = {} } = useQuery({
    queryKey: ['guest-balances'],
    queryFn: async () => {
      const balancePromises = guestAccounts.map(async (guest) => {
        const { data, error } = await supabase
          .rpc('calculate_user_balance', { user_uuid: guest.id });
        return [guest.id, error ? 0 : data];
      });
      
      const results = await Promise.all(balancePromises);
      return Object.fromEntries(results);
    },
    enabled: guestAccounts.length > 0,
  });

  const createGuestAccount = useMutation({
    mutationFn: async (guestNumber: number) => {
      // Generate a unique guest ID
      const guestId = crypto.randomUUID();
      
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: guestId,
          name: `Gast ${guestNumber}`,
          email: `guest_${guestNumber}@chiro.local`,
          guest_account: true,
          allow_credit: true,
          role: 'user',
          guest_number: guestNumber,
          occupied: false
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-accounts'] });
      toast({
        title: "Gast account aangemaakt",
        description: `Account voor Gast ${guestNumber} is succesvol aangemaakt.`,
      });
      setGuestNumber('');
      setIsCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij aanmaken",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const settleGuestAccount = useMutation({
    mutationFn: async ({ guestId, amount, guestName }: { guestId: string; amount: number; guestName: string }) => {
      // Create an adjustment to bring balance to 0
      const { data: balanceData, error: balanceError } = await supabase
        .from('adjustments')
        .insert({
          user_id: guestId,
          delta_cents: -amount, // Negative to neutralize the balance
          reason: `Saldo vrijgeven gast account - ${guestName}`,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });
      
      if (balanceError) throw balanceError;
      
      return { balance: balanceData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-balances'] });
      queryClient.invalidateQueries({ queryKey: ['guest-accounts'] });
      toast({
        title: "Saldo vrijgegeven",
        description: "Het saldo is teruggebracht naar €0,00.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij vrijgeven saldo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteGuestAccount = useMutation({
    mutationFn: async (guestId: string) => {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', guestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-accounts'] });
      toast({
        title: "Gast account verwijderd",
        description: "Het gast account is succesvol verwijderd.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij verwijderen",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const freeGuestAccount = useMutation({
    mutationFn: async (guestId: string) => {
      const { data, error } = await supabase.rpc('free_guest_account', { _guest_id: guestId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-accounts'] });
      toast({
        title: "Gast account vrijgegeven",
        description: "Het account is weer beschikbaar.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fout bij vrijgeven",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const handleCreateGuest = () => {
    const number = parseInt(guestNumber);
    if (!guestNumber.trim() || isNaN(number) || number <= 0) {
      toast({
        title: "Geldig nummer vereist",
        description: "Voer een geldig gastnummer in (bijv. 1, 2, 3).",
        variant: "destructive",
      });
      return;
    }
    createGuestAccount.mutate(number);
  };

  const handleSettleAccount = (guestId: string, balance: number, guestName: string) => {
    if (balance === 0) {
      toast({
        title: "Geen wijziging nodig",
        description: "Dit account heeft al een saldo van €0,00.",
        variant: "destructive",
      });
      return;
    }
    settleGuestAccount.mutate({ guestId, amount: balance, guestName });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Gast Accounts
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Gast Toevoegen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nieuw Gast Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="guest-number">Gastnummer</Label>
                  <Input
                    id="guest-number"
                    value={guestNumber}
                    onChange={(e) => setGuestNumber(e.target.value)}
                    placeholder="Bijv. 1, 2, 3, ..."
                    type="number"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Annuleren
                  </Button>
                  <Button onClick={handleCreateGuest} disabled={createGuestAccount.isPending}>
                    {createGuestAccount.isPending ? 'Aanmaken...' : 'Account Aanmaken'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Beheer tijdelijke gast accounts die negatief kunnen staan
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">Laden...</div>
        ) : guestAccounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Geen gast accounts gevonden
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gast</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Aangemaakt</TableHead>
                  <TableHead>Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guestAccounts.map((guest) => {
                  const balance = balances[guest.id] || 0;
                  return (
                    <TableRow key={guest.id}>
                      <TableCell className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {guest.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{guest.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {guest.occupied_by_name || 'Beschikbaar'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={guest.occupied ? "destructive" : "secondary"}>
                          {guest.occupied ? "Bezet" : "Beschikbaar"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${
                          balance < 0 ? 'text-destructive' : 'text-success'
                        }`}>
                          {formatCurrency(balance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(guest.created_at).toLocaleDateString('nl-BE')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {balance !== 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSettleAccount(guest.id, balance, guest.occupied_by_name || guest.name)}
                              disabled={settleGuestAccount.isPending}
                            >
                              <CreditCard className="h-4 w-4 mr-1" />
                              Saldo vrijgeven
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Gast account verwijderen</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Weet je zeker dat je het account van <strong>{guest.name}</strong> wilt verwijderen?
                                  Deze actie kan niet ongedaan worden gemaakt.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => deleteGuestAccount.mutate(guest.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Verwijderen
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GuestAccountManager;