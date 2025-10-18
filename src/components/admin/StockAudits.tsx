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
import { ClipboardCheck, Plus, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface Item {
  id: string;
  name: string;
  stock_quantity: number | null;
  category?: string;
}

interface AuditItem {
  itemId: string;
  name: string;
  expectedQuantity: number;
  actualQuantity: number;
  difference: number;
  notes: string;
}

interface StockAudit {
  id: string;
  created_at: string;
  completed_at: string | null;
  notes: string | null;
  status: string;
  created_by: string;
  profiles?: {
    name: string;
  };
}

const StockAudits = () => {
  const [isCreatingAudit, setIsCreatingAudit] = useState(false);
  const [auditNotes, setAuditNotes] = useState('');
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['audit-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, stock_quantity, category')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data as Item[];
    },
    enabled: isCreatingAudit,
  });

  const { data: audits = [], isLoading: auditsLoading } = useQuery({
    queryKey: ['stock-audits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_audits')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch creator names separately
      const auditsWithNames = await Promise.all(
        data.map(async (audit) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', audit.created_by)
            .single();
          
          return {
            ...audit,
            profiles: profile ? { name: profile.name } : null,
          };
        })
      );
      
      return auditsWithNames as StockAudit[];
    },
  });

  const { data: auditDetails, refetch: refetchAuditDetails } = useQuery({
    queryKey: ['audit-details'],
    queryFn: async () => {
      return null;
    },
    enabled: false,
  });

  const startNewAudit = () => {
    setIsCreatingAudit(true);
    const initialAuditItems = items.map(item => ({
      itemId: item.id,
      name: item.name,
      expectedQuantity: item.stock_quantity || 0,
      actualQuantity: item.stock_quantity || 0,
      difference: 0,
      notes: '',
    }));
    setAuditItems(initialAuditItems);
  };

  const updateActualQuantity = (itemId: string, actualQuantity: number) => {
    setAuditItems(prev => prev.map(item => {
      if (item.itemId === itemId) {
        const difference = actualQuantity - item.expectedQuantity;
        return { ...item, actualQuantity, difference };
      }
      return item;
    }));
  };

  const updateItemNotes = (itemId: string, notes: string) => {
    setAuditItems(prev => prev.map(item => 
      item.itemId === itemId ? { ...item, notes } : item
    ));
  };

  const createAuditMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Niet ingelogd');

      // Create audit
      const { data: audit, error: auditError } = await supabase
        .from('stock_audits')
        .insert({
          created_by: user.id,
          notes: auditNotes,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (auditError) throw auditError;

      // Create audit items
      const auditItemsData = auditItems.map(item => ({
        audit_id: audit.id,
        item_id: item.itemId,
        expected_quantity: item.expectedQuantity,
        actual_quantity: item.actualQuantity,
        difference: item.difference,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from('stock_audit_items')
        .insert(auditItemsData);

      if (itemsError) throw itemsError;

      // Update stock quantities and create stock transactions for discrepancies
      for (const item of auditItems) {
        if (item.difference !== 0) {
          // Update item stock
          const { error: updateError } = await supabase
            .from('items')
            .update({ stock_quantity: item.actualQuantity })
            .eq('id', item.itemId);

          if (updateError) throw updateError;

          // Log stock transaction
          const { error: transactionError } = await supabase
            .from('stock_transactions')
            .insert({
              item_id: item.itemId,
              quantity_change: item.difference,
              transaction_type: 'adjustment',
              notes: `Aangifte correctie: ${item.notes || 'Verschil tussen verwacht en getelde voorraad'}`,
              created_by: user.id,
            });

          if (transactionError) throw transactionError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-audits'] });
      queryClient.invalidateQueries({ queryKey: ['admin-items'] });
      toast({
        title: "Aangifte voltooid",
        description: "De voorraadaangifte is succesvol opgeslagen.",
      });
      setIsCreatingAudit(false);
      setAuditNotes('');
      setAuditItems([]);
    },
    onError: (error) => {
      toast({
        title: "Fout",
        description: "Er ging iets mis bij het opslaan van de aangifte.",
        variant: "destructive",
      });
      console.error(error);
    },
  });

  const viewAuditDetails = async (auditId: string) => {
    const { data, error } = await supabase
      .from('stock_audit_items')
      .select(`
        *,
        items:item_id (name)
      `)
      .eq('audit_id', auditId);

    if (error) {
      toast({
        title: "Fout",
        description: "Kon aangifte details niet laden.",
        variant: "destructive",
      });
      return;
    }

    return data;
  };

  const totalLoss = auditItems.reduce((sum, item) => 
    item.difference < 0 ? sum + Math.abs(item.difference) : sum, 0
  );

  if (auditsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aangiftes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Laden...</div>
        </CardContent>
      </Card>
    );
  }

  if (isCreatingAudit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Nieuwe aangifte
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Vergelijk de online voorraad met de fysieke voorraad en noteer de verschillen
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="audit-notes">Notities (optioneel)</Label>
            <Textarea
              id="audit-notes"
              value={auditNotes}
              onChange={(e) => setAuditNotes(e.target.value)}
              placeholder="Algemene opmerkingen over deze aangifte..."
            />
          </div>

          {totalLoss > 0 && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive rounded-lg">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <div className="font-medium text-destructive">
                  Totaal verlies: {totalLoss} items
                </div>
                <div className="text-sm text-muted-foreground">
                  Er zijn items met een negatief verschil
                </div>
              </div>
            </div>
          )}

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Verwacht</TableHead>
                  <TableHead>Geteld</TableHead>
                  <TableHead>Verschil</TableHead>
                  <TableHead>Notities</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditItems.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.expectedQuantity}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.actualQuantity}
                        onChange={(e) => updateActualQuantity(item.itemId, parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <span className={item.difference < 0 ? 'text-destructive font-medium' : item.difference > 0 ? 'text-green-600 font-medium' : ''}>
                        {item.difference > 0 ? '+' : ''}{item.difference}
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
                setIsCreatingAudit(false);
                setAuditItems([]);
                setAuditNotes('');
              }}
            >
              Annuleren
            </Button>
            <Button
              onClick={() => createAuditMutation.mutate()}
              disabled={createAuditMutation.isPending}
            >
              {createAuditMutation.isPending ? 'Bezig...' : 'Aangifte opslaan'}
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
                <ClipboardCheck className="h-5 w-5" />
                Aangiftes
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Beheer voorraadcontroles en registreer verliezen
              </p>
            </div>
            <Button onClick={startNewAudit} disabled={itemsLoading}>
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe aangifte
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
                  <TableHead>Status</TableHead>
                  <TableHead>Notities</TableHead>
                  <TableHead>Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nog geen aangiftes gemaakt
                    </TableCell>
                  </TableRow>
                ) : (
                  audits.map((audit) => (
                    <TableRow key={audit.id}>
                      <TableCell>
                        {format(new Date(audit.created_at), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>{audit.profiles?.name || 'Onbekend'}</TableCell>
                      <TableCell>
                        <Badge variant={audit.status === 'completed' ? 'default' : 'secondary'}>
                          {audit.status === 'completed' ? 'Voltooid' : 'Open'}
                        </Badge>
                      </TableCell>
                      <TableCell>{audit.notes || '-'}</TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                const details = await viewAuditDetails(audit.id);
                                if (details) {
                                  // Details will be shown in the dialog
                                }
                              }}
                            >
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Aangifte details</DialogTitle>
                            </DialogHeader>
                            <AuditDetailsView auditId={audit.id} />
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

const AuditDetailsView = ({ auditId }: { auditId: string }) => {
  const { data: details, isLoading } = useQuery({
    queryKey: ['audit-details', auditId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_audit_items')
        .select(`
          *,
          items:item_id (name)
        `)
        .eq('audit_id', auditId);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Laden...</div>;
  }

  const totalLoss = details?.reduce((sum: number, item: any) => 
    item.difference < 0 ? sum + Math.abs(item.difference) : sum, 0
  ) || 0;

  const totalGain = details?.reduce((sum: number, item: any) => 
    item.difference > 0 ? sum + item.difference : sum, 0
  ) || 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-muted-foreground">Totaal verlies</div>
          <div className="text-2xl font-bold text-destructive">{totalLoss} items</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-muted-foreground">Totaal surplus</div>
          <div className="text-2xl font-bold text-green-600">{totalGain} items</div>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Verwacht</TableHead>
              <TableHead>Geteld</TableHead>
              <TableHead>Verschil</TableHead>
              <TableHead>Notities</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {details?.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell>{item.items?.name}</TableCell>
                <TableCell>{item.expected_quantity}</TableCell>
                <TableCell>{item.actual_quantity}</TableCell>
                <TableCell>
                  <span className={item.difference < 0 ? 'text-destructive font-medium' : item.difference > 0 ? 'text-green-600 font-medium' : ''}>
                    {item.difference > 0 ? '+' : ''}{item.difference}
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

export default StockAudits;
