import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Send, Users, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Profile {
  id: string;
  name: string;
  email: string;
  guest_account: boolean;
}

export const NotificationManagement = () => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [recipientType, setRecipientType] = useState<'all' | 'individual'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['users-for-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, guest_account')
        .eq('active', true)
        .eq('guest_account', false)
        .order('name');

      if (error) throw error;
      return data as Profile[];
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Niet ingelogd');

      if (recipientType === 'all') {
        // Send announcement to all users
        const { error } = await supabase
          .from('notifications')
          .insert({
            title,
            message,
            type: 'announcement',
            created_by: user.id,
            user_id: null, // null means it's for everyone
          });

        if (error) throw error;
      } else {
        // Send personal notification
        if (!selectedUserId) throw new Error('Selecteer een gebruiker');

        const { error } = await supabase
          .from('notifications')
          .insert({
            title,
            message,
            type: 'personal',
            created_by: user.id,
            user_id: selectedUserId,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Melding verzonden",
        description: recipientType === 'all' 
          ? "Algemene melding is verzonden naar alle gebruikers"
          : "Persoonlijke melding is verzonden",
      });
      // Reset form
      setTitle('');
      setMessage('');
      setRecipientType('all');
      setSelectedUserId('');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      toast({
        title: "Fout bij verzenden",
        description: error instanceof Error ? error.message : "Er is iets misgegaan",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !message.trim()) {
      toast({
        title: "Ontbrekende velden",
        description: "Vul een titel en bericht in",
        variant: "destructive",
      });
      return;
    }

    if (recipientType === 'individual' && !selectedUserId) {
      toast({
        title: "Geen gebruiker geselecteerd",
        description: "Selecteer een gebruiker om een persoonlijke melding te sturen",
        variant: "destructive",
      });
      return;
    }

    sendNotificationMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meldingen Beheren</CardTitle>
        <CardDescription>
          Stuur persoonlijke berichten of algemene announcements naar gebruikers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="recipient-type">Type melding</Label>
            <Select
              value={recipientType}
              onValueChange={(value: 'all' | 'individual') => {
                setRecipientType(value);
                setSelectedUserId('');
              }}
            >
              <SelectTrigger id="recipient-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Algemene melding (alle gebruikers)</span>
                  </div>
                </SelectItem>
                <SelectItem value="individual">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>Persoonlijke melding (specifieke gebruiker)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {recipientType === 'individual' && (
            <div className="space-y-2">
              <Label htmlFor="user-select">Gebruiker</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id="user-select">
                  <SelectValue placeholder="Selecteer een gebruiker" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <span>{user.name}</span>
                        <span className="text-xs text-muted-foreground">({user.email})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Titel</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bijv. Betaling verwerkt"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Bericht</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Typ hier je bericht..."
              rows={5}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/1000 karakters
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              disabled={sendNotificationMutation.isPending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {sendNotificationMutation.isPending ? 'Verzenden...' : 'Verzenden'}
            </Button>
            
            {recipientType === 'all' && (
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" />
                Wordt verzonden naar {users.length} gebruiker{users.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
