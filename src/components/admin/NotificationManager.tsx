import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Bell, Users, User } from 'lucide-react';
import { toast } from 'sonner';

export default function NotificationManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'all' | 'specific'>('all');
  const [selectedUserId, setSelectedUserId] = useState('');

  const { data: profiles = [] } = useQuery({
    queryKey: ['admin-profiles-for-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: sentNotifications = [], isLoading } = useQuery({
    queryKey: ['admin-sent-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, type, created_at, user_id, profiles!notifications_user_id_fkey(name)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Niet ingelogd');
      if (!title.trim() || !message.trim()) throw new Error('Vul titel en bericht in');

      if (target === 'all') {
        // Send to all active users
        const inserts = profiles.map(p => ({
          title: title.trim(),
          message: message.trim(),
          type: 'broadcast' as const,
          action_type: 'announcement',
          created_by: user.id,
          user_id: p.id,
        }));
        const { error } = await supabase.from('notifications').insert(inserts);
        if (error) throw error;
      } else {
        if (!selectedUserId) throw new Error('Selecteer een gebruiker');
        const { error } = await supabase.from('notifications').insert({
          title: title.trim(),
          message: message.trim(),
          type: 'personal',
          action_type: 'announcement',
          created_by: user.id,
          user_id: selectedUserId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Melding verstuurd!');
      setTitle('');
      setMessage('');
      setSelectedUserId('');
      queryClient.invalidateQueries({ queryKey: ['admin-sent-notifications'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <div className="space-y-6">
      {/* Send notification form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Melding versturen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Ontvanger</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as 'all' | 'specific')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Iedereen</span>
                </SelectItem>
                <SelectItem value="specific">
                  <span className="flex items-center gap-2"><User className="h-4 w-4" /> Specifieke gebruiker</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {target === 'specific' && (
            <div className="space-y-2">
              <Label>Gebruiker</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kies een gebruiker..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Titel</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titel van de melding..."
            />
          </div>

          <div className="space-y-2">
            <Label>Bericht</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Schrijf je bericht..."
              rows={3}
            />
          </div>

          <Button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !title.trim() || !message.trim()}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendMutation.isPending ? 'Versturen...' : 'Versturen'}
          </Button>
        </CardContent>
      </Card>

      {/* Sent notifications history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Verstuurde meldingen
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Laden...</p>
          ) : sentNotifications.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nog geen meldingen verstuurd.</p>
          ) : (
            <div className="space-y-3">
              {sentNotifications.map(n => (
                <div key={n.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {n.type === 'broadcast' ? 'Iedereen' : (n.profiles as any)?.name || 'Persoonlijk'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
