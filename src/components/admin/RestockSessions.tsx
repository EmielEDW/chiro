import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Package, Plus, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface Item {
  id: string;
  name: string;
  stock_quantity: number | null;
  category?: string;
}

interface RestockItem {
  itemId: string;
  name: string;
  previousQuantity: number;
  newQuantity: number;
  quantityChange: number;
  notes: string;
}

interface RestockSession {
  id: string;
  created_at: string;
  notes: string | null;
  status: string;
  created_by: string;
  profiles?: {
    name: string;
  };
}

const RestockSessions = () => {
  const [isCreatingRestock, setIsCreatingRestock] = useState(false);
  const [restockNotes, setRestockNotes] = useState('');
  const [restockItems, setRestockItems] = useState<RestockItem[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['restock-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, stock_quantity, category')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data as Item[];
    },
    enabled: isCreatingRestock,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['restock-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restock_sessions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch creator names separately
      const sessionsWithNames = await Promise.all(
        data.map(async (session) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', session.created_by)
            .single();
          
          return {
            ...session,
            profiles: profile ? { name: profile.name } : null,
          };
        })
      );
      
      return sessionsWithNames as RestockSession[];
    },
  });

  const startNewRestock = () => {
    setIsCreatingRestock(true);
    const initialRestockItems = items.map(item => ({
      itemId: item.id,
      name: item.name,
      previousQuantity: item.stock_quantity || 0,
      newQuantity: item.stock_quantity || 0,
      quantityChange: 0,
      notes: '',
    }));
    setRestockItems(initialRestockItems);
  };

  const updateNewQuantity = (itemId: string, newQuantity: number) => {
    setRestockItems(prev => prev.map(item => {
      if (item.itemId === itemId) {
        const quantityChange = newQuantity - item.previousQuantity;
        return { ...item, newQuantity, quantityChange };
      }
      return item;
    }));
  };

  const updateItemNotes = (itemId: string, notes: string) => {
    setRestockItems(prev => prev.map(item => 
      item.itemId === itemId ? { ...item, notes } : item
    ));
  };

  const createRestockMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Niet ingelogd');

      // Create restock session
      const { data: session, error: sessionError } = await supabase
        .from('restock_sessions')
        .insert({
          created_by: user.id,
          notes: restockNotes,
          status: 'completed',
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Only process items with changes
      const changedItems = restockItems.filter(item => item.quantityChange !== 0);

      if (changedItems.length === 0) {
        throw new Error('Geen wijzigingen om op te slaan');
      }

      // Create restock items
      const restockItemsData = changedItems.map(item => ({
        restock_session_id: session.id,
        item_id: item.itemId,
        previous_quantity: item.previousQuantity,
        new_quantity: item.newQuantity,
        quantity_change: item.quantityChange,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from('restock_items')
        .insert(restockItemsData);

      if (itemsError) throw itemsError;

      // Update stock quantities and create stock transactions
      for (const item of changedItems) {
        // Update item stock
        const { error: updateError } = await supabase
          .from('items')
          .update({ stock_quantity: item.newQuantity })
          .eq('id', item.itemId);

        if (updateError) throw updateError;

        // Log stock transaction
        const { error: transactionError } = await supabase
          .from('stock_transactions')
          .insert({
            item_id: item.itemId,
            quantity_change: item.quantityChange,
            transaction_type: item.quantityChange > 0 ? 'purchase' : 'adjustment',
            notes: `Herbevooarding: ${item.notes || 'Voorraad aangepast'}`,
            created_by: user.id,
          });

        if (transactionError) throw transactionError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restock-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-items'] });
      toast({
        title: "Herbevooarding voltooid",
        description: "De voorraadaanpassingen zijn succesvol opgeslagen.",
      });
      setIsCreatingRestock(false);
      setRestockNotes('');
      setRestockItems([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Fout",
        description: error.message || "Er ging iets mis bij het opslaan van de herbevooarding.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  const totalIncrease = restockItems.reduce((sum, item) => 
    item.quantityChange > 0 ? sum + item.quantityChange : sum, 0
  );

  const totalDecrease = restockItems.reduce((sum, item) => 
    item.quantityChange < 0 ? sum + Math.abs(item.quantityChange) : sum, 0
  );

  if (sessionsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Herbevoorrading</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Laden...</div>
        </CardContent>
      </Card>
    );
  }

  if (isCreatingRestock) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Nieuwe herbevooarding
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Pas de voorraad aan voor meerdere items tegelijk
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="restock-notes">Notities (optioneel)</Label>
            <Textarea
              id="restock-notes"
              value={restockNotes}
              onChange={(e) => setRestockNotes(e.target.value)}
              placeholder="Algemene opmerkingen over deze herbevooarding..."
            />
          </div>

          {(totalIncrease > 0 || totalDecrease > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {totalIncrease > 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-700">
                      +{totalIncrease} items
                    </div>
                    <div className="text-sm text-green-600">
                      Toegevoegd aan voorraad
                    </div>
                  </div>
                </div>
              )}
              {totalDecrease > 0 && (
                <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-orange-600 rotate-180" />
                  <div>
                    <div className="font-medium text-orange-700">
                      -{totalDecrease} items
                    </div>
                    <div className="text-sm text-orange-600">
                      Verwijderd uit voorraad
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Huidige voorraad</TableHead>
                  <TableHead>Nieuwe voorraad</TableHead>
                  <TableHead>Wijziging</TableHead>
                  <TableHead>Notities</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restockItems.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.previousQuantity}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.newQuantity}
                        onChange={(e) => updateNewQuantity(item.itemId, parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <span className={
                        item.quantityChange > 0 
                          ? 'text-green-600 font-medium' 
                          : item.quantityChange < 0 
                          ? 'text-orange-600 font-medium' 
                          : ''
                      }>
                        {item.quantityChange > 0 ? '+' : ''}{item.quantityChange}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updateItemNotes(item.itemId, e.target.value)}
                        placeholder="Optionele notitie..."
                        className="w-full"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreatingRestock(false);
                setRestockItems([]);
                setRestockNotes('');
              }}
            >
              Annuleren
            </Button>
            <Button
              onClick={() => createRestockMutation.mutate()}
              disabled={createRestockMutation.isPending}
            >
              {createRestockMutation.isPending ? 'Bezig...' : 'Opslaan'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Herbevoorrading
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Beheer bulk voorraadaanpassingen en bekijk geschiedenis
              </p>
            </div>
            <Button onClick={startNewRestock} disabled={itemsLoading}>
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe herbevooarding
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Aangemaakt door</TableHead>
                  <TableHead>Notities</TableHead>
                  <TableHead>Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nog geen herbevoorrading sessies
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        {format(new Date(session.created_at), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>{session.profiles?.name || 'Onbekend'}</TableCell>
                      <TableCell>{session.notes || '-'}</TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Herbevooarding details</DialogTitle>
                            </DialogHeader>
                            <RestockDetailsView sessionId={session.id} />
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const RestockDetailsView = ({ sessionId }: { sessionId: string }) => {
  const { data: details, isLoading } = useQuery({
    queryKey: ['restock-details', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restock_items')
        .select(`
          *,
          items:item_id (name)
        `)
        .eq('restock_session_id', sessionId);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Laden...</div>;
  }

  const totalIncrease = details?.reduce((sum: number, item: any) => 
    item.quantity_change > 0 ? sum + item.quantity_change : sum, 0
  ) || 0;

  const totalDecrease = details?.reduce((sum: number, item: any) => 
    item.quantity_change < 0 ? sum + Math.abs(item.quantity_change) : sum, 0
  ) || 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-muted-foreground">Totaal toegevoegd</div>
          <div className="text-2xl font-bold text-green-600">+{totalIncrease} items</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-muted-foreground">Totaal verwijderd</div>
          <div className="text-2xl font-bold text-orange-600">-{totalDecrease} items</div>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Vorige voorraad</TableHead>
              <TableHead>Nieuwe voorraad</TableHead>
              <TableHead>Wijziging</TableHead>
              <TableHead>Notities</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {details?.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell>{item.items?.name || 'Onbekend'}</TableCell>
                <TableCell>{item.previous_quantity}</TableCell>
                <TableCell>{item.new_quantity}</TableCell>
                <TableCell>
                  <span className={
                    item.quantity_change > 0 
                      ? 'text-green-600 font-medium' 
                      : item.quantity_change < 0 
                      ? 'text-orange-600 font-medium' 
                      : ''
                  }>
                    {item.quantity_change > 0 ? '+' : ''}{item.quantity_change}
                  </span>
                </TableCell>
                <TableCell>{item.notes || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default RestockSessions;