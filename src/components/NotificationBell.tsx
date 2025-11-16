import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Bell, AlertCircle, DollarSign, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'personal' | 'announcement';
  action_type: 'announcement' | 'payment_request' | 'reminder' | 'alert' | 'info';
  payment_amount_cents: number | null;
  payment_status: 'pending' | 'paid' | 'cancelled' | null;
  requires_acknowledgment: boolean;
  acknowledged_at: string | null;
  created_at: string;
  read: boolean;
  read_at: string | null;
}

export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${user.id},and(type.eq.announcement,user_id.is.null)`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      toast({
        title: "Fout",
        description: "Kon notificatie niet markeren als gelezen",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const unreadIds = notifications
        .filter(n => !n.read)
        .map(n => n.id);

      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .in('id', unreadIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: "Alle berichten gemarkeerd als gelezen",
      });
    },
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const handlePaymentRequest = (notification: Notification) => {
    if (notification.payment_amount_cents && notification.payment_status === 'pending') {
      // Mark as read and navigate to pay
      if (!notification.read) {
        markAsReadMutation.mutate(notification.id);
      }
      setOpen(false);
      navigate('/', { state: { openTopUp: true, amount: notification.payment_amount_cents / 100 } });
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'payment_request':
        return <DollarSign className="h-4 w-4 text-green-500" />;
      case 'alert':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'reminder':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Meldingen</SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                Alles markeren als gelezen
              </Button>
            )}
          </div>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-8rem)] mt-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Geen meldingen
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    notification.read 
                      ? 'bg-background hover:bg-accent/50' 
                      : notification.action_type === 'alert' || notification.requires_acknowledgment
                      ? 'bg-destructive/10 hover:bg-destructive/20 border-destructive/30'
                      : 'bg-accent/20 hover:bg-accent/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getActionIcon(notification.action_type)}
                        <h4 className="font-semibold text-sm">{notification.title}</h4>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                        {notification.message}
                      </p>
                      
                      {notification.action_type === 'payment_request' && notification.payment_amount_cents && (
                        <div className="mt-3 flex items-center gap-2">
                          <Badge variant={notification.payment_status === 'paid' ? 'default' : 'outline'} className="gap-1">
                            <DollarSign className="h-3 w-3" />
                            €{(notification.payment_amount_cents / 100).toFixed(2)}
                          </Badge>
                          {notification.payment_status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePaymentRequest(notification);
                              }}
                            >
                              Betalen
                            </Button>
                          )}
                          {notification.payment_status === 'paid' && (
                            <span className="text-xs text-green-600 font-medium">✓ Betaald</span>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(notification.created_at), 'dd MMM yyyy HH:mm', { locale: nl })}
                        </p>
                        {notification.type === 'announcement' && (
                          <Badge variant="secondary" className="text-xs">
                            Algemeen
                          </Badge>
                        )}
                        {notification.requires_acknowledgment && !notification.acknowledged_at && (
                          <Badge variant="destructive" className="text-xs">
                            Bevestiging vereist
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
