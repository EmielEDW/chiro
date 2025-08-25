import { useQuery } from '@tanstack/react-query';
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
import { useState } from 'react';
import UserConsumptionHistory from './UserConsumptionHistory';
import BalanceAdjustmentDialog from './BalanceAdjustmentDialog';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  allow_credit: boolean;
  created_at: string;
}

const UserManagement = () => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

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
                <TableHead>Credit toegestaan</TableHead>
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
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Lid sinds {new Date(user.created_at).toLocaleDateString('nl-BE')}
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
                    <Badge variant={user.allow_credit ? "default" : "secondary"}>
                      {user.allow_credit ? "Ja" : "Nee"}
                    </Badge>
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
                      
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {/* TODO: Delete user */}}
                        title="Gebruiker verwijderen"
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
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