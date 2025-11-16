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
import { Send, Users, User, DollarSign, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

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
  const [actionType, setActionType] = useState<'announcement' | 'payment_request' | 'reminder' | 'alert' | 'info'>('announcement');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [requiresAcknowledgment, setRequiresAcknowledgment] = useState(false);
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

      const paymentAmountCents = paymentAmount ? Math.round(parseFloat(paymentAmount) * 100) : null;

      if (recipientType === 'all') {
        // Send announcement to all users
        const { error } = await supabase
          .from('notifications')
          .insert({
            title,
            message,
            type: 'announcement',
            action_type: actionType,
            created_by: user.id,
            user_id: null, // null means it's for everyone
            payment_amount_cents: paymentAmountCents,
            payment_status: paymentAmountCents ? 'pending' : null,
            requires_acknowledgment: requiresAcknowledgment,
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
            action_type: actionType,
            created_by: user.id,
            user_id: selectedUserId,
            payment_amount_cents: paymentAmountCents,
            payment_status: paymentAmountCents ? 'pending' : null,
            requires_acknowledgment: requiresAcknowledgment,
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
      setActionType('announcement');
      setPaymentAmount('');
      setRequiresAcknowledgment(false);
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
            <Label htmlFor="action-type">Type melding</Label>
            <Select
              value={actionType}
              onValueChange={(value: any) => setActionType(value)}
            >
              <SelectTrigger id="action-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="announcement">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Aankondiging</span>
                  </div>
                </SelectItem>
                <SelectItem value="payment_request">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span>Betalingsverzoek</span>
                  </div>
                </SelectItem>
                <SelectItem value="reminder">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>Herinnering</span>
                  </div>
                </SelectItem>
                <SelectItem value="alert">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Waarschuwing</span>
                  </div>
                </SelectItem>
                <SelectItem value="info">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    <span>Informatie</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          {actionType === 'payment_request' && (
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Betalingsbedrag (optioneel)</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">€</span>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Laat leeg voor een betalingsverzoek zonder specifiek bedrag
              </p>
            </div>
          )}

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="requires-ack">Bevestiging vereist</Label>
              <p className="text-xs text-muted-foreground">
                Gebruiker moet deze melding bevestigen voordat ze verder kunnen
              </p>
            </div>
            <Switch
              id="requires-ack"
              checked={requiresAcknowledgment}
              onCheckedChange={setRequiresAcknowledgment}
            />
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
