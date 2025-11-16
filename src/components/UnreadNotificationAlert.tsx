import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface ImportantNotification {
  id: string;
  title: string;
  message: string;
  action_type: string;
  payment_amount_cents: number | null;
  payment_status: string | null;
  requires_acknowledgment: boolean;
  created_at: string;
}

export const UnreadNotificationAlert = () => {
  const [currentNotification, setCurrentNotification] = useState<ImportantNotification | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const navigate = useNavigate();

  const { data: importantNotifications = [] } = useQuery({
    queryKey: ['important-notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${user.id},and(type.eq.announcement,user_id.is.null)`)
        .eq('read', false)
        .or('requires_acknowledgment.eq.true,action_type.eq.alert,action_type.eq.payment_request')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as ImportantNotification[];
    },
    refetchInterval: 30000, // Check every 30 seconds
  });

  useEffect(() => {
    // Find first unread notification that hasn't been dismissed
    const nextNotification = importantNotifications.find(
      n => !dismissedIds.includes(n.id)
    );
    
    if (nextNotification && !currentNotification) {
      setCurrentNotification(nextNotification);
    }
  }, [importantNotifications, dismissedIds, currentNotification]);

  const handleDismiss = async () => {
    if (!currentNotification) return;
    
    // Mark as read in database
    await supabase
      .from('notifications')
      .update({ 
        read: true, 
        read_at: new Date().toISOString(),
        acknowledged_at: currentNotification.requires_acknowledgment ? new Date().toISOString() : null
      })
      .eq('id', currentNotification.id);

    // Add to dismissed list
    setDismissedIds(prev => [...prev, currentNotification.id]);
    setCurrentNotification(null);
  };

  const handlePayNow = () => {
    if (currentNotification?.payment_amount_cents) {
      handleDismiss();
      navigate('/', { state: { openTopUp: true, amount: currentNotification.payment_amount_cents / 100 } });
    }
  };

  const getIcon = () => {
    if (!currentNotification) return null;
    
    switch (currentNotification.action_type) {
      case 'payment_request':
        return <DollarSign className="h-6 w-6 text-green-500" />;
      case 'alert':
        return <AlertTriangle className="h-6 w-6 text-destructive" />;
      case 'reminder':
        return <AlertCircle className="h-6 w-6 text-yellow-500" />;
      case 'info':
        return <Info className="h-6 w-6 text-blue-500" />;
      default:
        return null;
    }
  };

  if (!currentNotification) return null;

  return (
    <AlertDialog open={!!currentNotification}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {getIcon()}
            <AlertDialogTitle className="text-xl">{currentNotification.title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base whitespace-pre-wrap">
            {currentNotification.message}
          </AlertDialogDescription>
          
          {currentNotification.action_type === 'payment_request' && currentNotification.payment_amount_cents && (
            <div className="mt-4 p-4 bg-accent/30 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Te betalen bedrag:</span>
                <Badge variant="outline" className="text-lg gap-1">
                  <DollarSign className="h-4 w-4" />
                  €{(currentNotification.payment_amount_cents / 100).toFixed(2)}
                </Badge>
              </div>
            </div>
          )}

          <div className="mt-4 text-xs text-muted-foreground">
            {format(new Date(currentNotification.created_at), 'dd MMMM yyyy HH:mm', { locale: nl })}
          </div>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          {currentNotification.action_type === 'payment_request' && currentNotification.payment_amount_cents && (
            <>
              <Button variant="outline" onClick={handleDismiss}>
                Later betalen
              </Button>
              <Button onClick={handlePayNow}>
                <DollarSign className="h-4 w-4 mr-2" />
                Nu betalen
              </Button>
            </>
          )}
          {currentNotification.action_type !== 'payment_request' && (
            <Button onClick={handleDismiss} className="w-full">
              {currentNotification.requires_acknowledgment ? 'Bevestigen' : 'Begrepen'}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
