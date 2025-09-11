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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Eye, CreditCard, History, UserX } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import UserConsumptionHistory from './UserConsumptionHistory';
import BalanceAdjustmentDialog from './BalanceAdjustmentDialog';
import RoleManagement from './RoleManagement';

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
}

const UserManagement = () => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive">Admin</Badge>;
      case 'treasurer':
        return <Badge variant="secondary">Penningmeester</Badge>;
      default:
        return <Badge variant="outline">Gebruiker</Badge>;
    }
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const handleDeleteUser = async (userId: string, userName: string, isGuest: boolean) => {
    setDeletingUserId(userId);
    try {
      if (isGuest) {
        // For guest accounts, just delete the profile record
        // Consumptions and other data are preserved for statistics
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
        // For regular users, call edge function to delete from auth.users and profiles  
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

      // Refresh the users list by invalidating queries
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gebruikers beheer</CardTitle>
        <p className="text-sm text-muted-foreground">
          Beheer alle geregistreerde gebruikers en hun saldo's
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gebruiker</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {user.guest_account && user.occupied_by_name 
                          ? `${user.occupied_by_name} (${user.name})`
                          : user.name
                        }
                        {user.guest_account && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Gast
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {user.guest_account 
                          ? `Gast #${user.guest_number}`
                          : `Lid sinds ${new Date(user.created_at).toLocaleDateString('nl-BE')}`
                        }
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>
                    <span className={`font-medium ${
                      (balances[user.id] || 0) < 0 ? 'text-destructive' : 'text-success'
                    }`}>
                      {formatCurrency(balances[user.id] || 0)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.active ? "default" : "secondary"}>
                      {user.active ? "Actief" : "Inactief"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedUserId(user.id)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Consumptie geschiedenis - {user.name}</DialogTitle>
                          </DialogHeader>
                          {selectedUserId && (
                            <UserConsumptionHistory userId={selectedUserId} />
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      <BalanceAdjustmentDialog
                        userId={user.id}
                        userName={user.name}
                        currentBalance={balances[user.id] || 0}
                      />
                      
                      {!user.guest_account && (
                        <RoleManagement
                          userId={user.id}
                          userName={user.name}
                          currentRole={user.role}
                        />
                      )}
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Gebruiker verwijderen"
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {user.guest_account ? 'Gastaccount verwijderen' : 'Gebruiker verwijderen'}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Weet je zeker dat je <strong>{user.name}</strong> wilt verwijderen?
                              {user.guest_account 
                                ? ' Het gastaccount wordt verwijderd, maar alle transacties blijven bewaard voor statistieken.'
                                : ' Deze actie kan niet ongedaan worden gemaakt. Alle data van deze gebruiker wordt permanent verwijderd.'
                              }
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuleren</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteUser(user.id, user.name, user.guest_account)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              disabled={deletingUserId === user.id}
                            >
                              {deletingUserId === user.id ? 'Verwijderen...' : 'Verwijderen'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserManagement;