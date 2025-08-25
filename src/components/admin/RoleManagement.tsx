import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCog } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface RoleManagementProps {
  userId: string;
  userName: string;
  currentRole: string;
}

const RoleManagement = ({ userId, userName, currentRole }: RoleManagementProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newRole, setNewRole] = useState<string>(currentRole);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleRoleChange = async () => {
    if (newRole === currentRole) {
      setIsOpen(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('grant_user_role', {
        _target_user_id: userId,
        _new_role: newRole as 'user' | 'treasurer' | 'admin'
      });

      if (error) throw error;

      if (!data) {
        toast({
          title: "Rol wijziging mislukt",
          description: "Je hebt geen rechten om rollen te wijzigen.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Rol gewijzigd",
        description: `${userName} is nu ${newRole === 'admin' ? 'admin' : newRole === 'treasurer' ? 'penningmeester' : 'gebruiker'}.`,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-balances'] });
      
      setIsOpen(false);
    } catch (error: any) {
      toast({
        title: "Fout bij rol wijziging",
        description: error.message || "Er ging iets mis bij het wijzigen van de rol.",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserCog className="h-4 w-4 mr-2" />
          Rol wijzigen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rol wijzigen voor {userName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Huidige rol: <span className="font-semibold">{currentRole}</span></Label>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="new-role">Nieuwe rol</Label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue placeholder="Kies nieuwe rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Gebruiker</SelectItem>
                <SelectItem value="treasurer">Penningmeester</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Annuleren
            </Button>
            <Button 
              onClick={handleRoleChange} 
              disabled={loading || newRole === currentRole}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rol wijzigen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoleManagement;