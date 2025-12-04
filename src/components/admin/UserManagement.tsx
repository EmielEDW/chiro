import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { MoreHorizontal, Shield, UserX, Users, QrCode } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import BalanceAdjustmentDialog from './BalanceAdjustmentDialog';
import RoleManagement from './RoleManagement';
import QRCode from 'qrcode';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
  guest_account: boolean;
  occupied_by_name?: string;
  guest_number?: number;
  occupied?: boolean;
}

type ViewMode = 'users' | 'guests';

const UserManagement = () => {
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showFinalDeleteConfirm, setShowFinalDeleteConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('users');
  const [qrCodeData, setQrCodeData] = useState<{ name: string; url: string; balance: number } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: balances = {} } = useQuery({
    queryKey: ['user-balances'],
    queryFn: async () => {
      const balancePromises = users.map(async (user) => {
        const { data, error } = await supabase
          .rpc('calculate_user_balance', { user_uuid: user.id });
        return [user.id, error ? 0 : data];
      });
      
      const results = await Promise.all(balancePromises);
      return Object.fromEntries(results);
    },
    enabled: users.length > 0,
  });

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
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

  const closeGuestTab = async (guestId: string, guestName: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', guestId);
      
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-balances'] });
      
      toast({
        title: "Account verwijderd",
        description: `${guestName} is verwijderd. Transacties blijven bewaard voor statistieken.`,
      });
    } catch (error) {
      toast({
        title: "Fout",
        description: "Er ging iets mis bij het verwijderen van het account.",
        variant: "destructive",
      });
    }
  };

  const deleteGuestAccount = async (guestId: string) => {
    try {
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

      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-balances'] });
      
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

  const handleDeleteUser = async (userId: string, userName: string, isGuest: boolean) => {
    setDeletingUserId(userId);
    try {
      if (isGuest) {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', userId);
        
        if (error) throw error;

        toast({
          title: "Gastaccount verwijderd",
          description: `${userName} is verwijderd. Alle transacties blijven bewaard voor statistieken.`,
        });
      } else {
        const { data: result, error: invokeError } = await supabase.functions.invoke('delete-user', {
          body: { userId }
        });

        if (invokeError) {
          throw new Error(invokeError.message || 'Failed to delete user');
        }

        toast({
          title: "Gebruiker verwijderd",
          description: `${userName} is volledig verwijderd. De gebruiker kan nu opnieuw registreren met hetzelfde email adres.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-balances'] });
    } catch (error: any) {
      toast({
        title: "Fout bij verwijderen", 
        description: error.message || "Er ging iets mis bij het verwijderen van de gebruiker.",
        variant: "destructive",
      });
    } finally {
      setDeletingUserId(null);
      setShowDeleteConfirm(null);
      setShowFinalDeleteConfirm(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gebruikers beheer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Laden...</div>
        </CardContent>
      </Card>
    );
  }

  // Filter users based on view mode
  const regularUsers = users.filter(u => !u.guest_account);
  const guestAccounts = users.filter(u => u.guest_account && u.active);
  const occupiedGuests = guestAccounts.filter(g => g.occupied);
  const availableGuests = guestAccounts.filter(g => !g.occupied);

  // Render guest view
  if (viewMode === 'guests') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Actieve gasttabs ({occupiedGuests.length})
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('users')}
              >
                ← Terug naar gebruikers
              </Button>
            </div>
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
                          variant={(balances[guest.id] || 0) < 0 ? "destructive" : "default"}
                        >
                          {formatCurrency(balances[guest.id] || 0)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateQRCode(guest.id, guest.occupied_by_name || guest.name, balances[guest.id] || 0)}
                          >
                            <QrCode className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => closeGuestTab(guest.id, guest.occupied_by_name || guest.name)}
                          >
                            Account Afsluiten
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
                          {formatCurrency(balances[guest.id] || 0)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteGuestAccount(guest.id)}
                        >
                          <UserX className="h-3 w-3" />
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
  }

  // Render regular users view
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gebruikers beheer</CardTitle>
              <p className="text-sm text-muted-foreground">
                Beheer alle geregistreerde gebruikers en hun saldo's
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('guests')}
            >
              <Users className="h-4 w-4 mr-2" />
              Gasttabs ({occupiedGuests.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gebruiker</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regularUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {user.name}
                          {user.role === 'admin' && (
                            <span className="h-2.5 w-2.5 rounded-full bg-destructive" title="Admin" />
                          )}
                          {user.role === 'treasurer' && (
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" title="Penningmeester" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Lid sinds {new Date(user.created_at).toLocaleDateString('nl-BE')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${
                        (balances[user.id] || 0) < 0 ? 'text-destructive' : 'text-success'
                      }`}>
                        {formatCurrency(balances[user.id] || 0)}
                      </span>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                        <BalanceAdjustmentDialog
                          userId={user.id}
                          userName={user.name}
                          currentBalance={balances[user.id] || 0}
                        />
                        
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" title="Meer opties">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-2" align="end">
                            <div className="flex flex-col gap-1">
                              <RoleManagement
                                userId={user.id}
                                userName={user.name}
                                currentRole={user.role}
                                asMenuItem
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setShowDeleteConfirm(user.id)}
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                Verwijderen
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* First confirmation dialog */}
      <AlertDialog open={!!showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gebruiker verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je <strong>{users.find(u => u.id === showDeleteConfirm)?.name}</strong> wilt verwijderen?
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowFinalDeleteConfirm(showDeleteConfirm);
                setShowDeleteConfirm(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Doorgaan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Final confirmation dialog */}
      <AlertDialog open={!!showFinalDeleteConfirm} onOpenChange={(open) => !open && setShowFinalDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Laatste bevestiging
            </AlertDialogTitle>
            <AlertDialogDescription>
              Dit is je laatste kans om te annuleren. 
              <strong className="block mt-2">
                {users.find(u => u.id === showFinalDeleteConfirm)?.name}
              </strong> 
              wordt permanent verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                const user = users.find(u => u.id === showFinalDeleteConfirm);
                if (user) {
                  handleDeleteUser(user.id, user.name, user.guest_account);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingUserId === showFinalDeleteConfirm}
            >
              {deletingUserId === showFinalDeleteConfirm ? 'Verwijderen...' : 'Definitief verwijderen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserManagement;