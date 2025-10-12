import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, Package, Plus, Minus, Edit } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface Item {
  id: string;
  name: string;
  price_cents: number;
  category?: string;
  description?: string;
  image_url?: string;
  stock_quantity?: number;
  stock_alert_threshold?: number;
  notify_on_low_stock?: boolean;
}

const StockManagement = () => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [stockChange, setStockChange] = useState(0);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data as Item[];
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ itemId, change, notes, type }: { 
      itemId: string; 
      change: number; 
      notes: string; 
      type: string;
    }) => {
      // Update item stock
      const { error: updateError } = await supabase
        .from('items')
        .update({ 
          stock_quantity: (await supabase
            .from('items')
            .select('stock_quantity')
            .eq('id', itemId)
            .single()).data?.stock_quantity + change || change
        })
        .eq('id', itemId);
      
      if (updateError) throw updateError;

      // Log transaction
      const { error: logError } = await supabase
        .from('stock_transactions')
        .insert({
          item_id: itemId,
          quantity_change: change,
          transaction_type: type,
          notes,
        });
      
      if (logError) throw logError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-items'] });
      toast({
        title: "Voorraad bijgewerkt",
        description: "De voorraad is succesvol aangepast.",
      });
      setSelectedItem(null);
      setStockChange(0);
      setNotes('');
    },
    onError: (error) => {
      toast({
        title: "Fout",
        description: "Er ging iets mis bij het bijwerken van de voorraad.",
        variant: "destructive",
      });
    },
  });

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'chips':
        return 'bg-yellow-100 text-yellow-800';
      case 'frisdranken':
        return 'bg-blue-100 text-blue-800';
      case 'bieren':
        return 'bg-amber-100 text-amber-800';
      case 'sterke_dranken':
        return 'bg-red-100 text-red-800';
      case 'mixed_drinks':
        return 'bg-purple-100 text-purple-800';
      case 'andere':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryName = (category?: string) => {
    switch (category) {
      case 'chips':
        return 'Chips';
      case 'frisdranken':
        return 'Frisdranken';
      case 'bieren':
        return 'Bieren';
      case 'sterke_dranken':
        return 'Sterke dranken';
      case 'mixed_drinks':
        return 'Mixed Drinks';
      case 'andere':
        return 'Andere';
      default:
        return 'Overig';
    }
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const handleStockUpdate = (type: 'purchase' | 'adjustment') => {
    if (!selectedItem || stockChange === 0) return;
    
    updateStockMutation.mutate({
      itemId: selectedItem.id,
      change: stockChange,
      notes,
      type,
    });
  };

  const lowStockItems = items.filter(item => 
    item.stock_quantity !== null && 
    item.stock_quantity < (item.stock_alert_threshold || 10) &&
    item.category !== 'mixed_drinks' &&
    !item.name.toLowerCase().includes('boete') &&
    !item.name.toLowerCase().includes('te laat') &&
    (item.notify_on_low_stock !== false) // Only show if explicitly enabled or not set (defaults to true)
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Voorraad beheer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Laden...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Lage voorraad waarschuwing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Voorraad: {item.stock_quantity || 0}
                    </div>
                  </div>
                  <Badge variant="destructive">Laag</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Voorraad overzicht
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Beheer de voorraad van alle producten
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Categorie</TableHead>
                  <TableHead>Prijs</TableHead>
                  <TableHead>Voorraad</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isLowStock = item.stock_quantity !== null && 
                    item.stock_quantity < (item.stock_alert_threshold || 10);
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.category && (
                          <Badge variant="secondary" className={getCategoryColor(item.category)}>
                            {getCategoryName(item.category)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(item.price_cents)}</TableCell>
                      <TableCell>
                        <span className={`font-medium ${isLowStock ? 'text-destructive' : ''}`}>
                          {item.stock_quantity || 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        {isLowStock ? (
                          <Badge variant="destructive">Laag</Badge>
                        ) : (
                          <Badge variant="default">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedItem(item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Voorraad aanpassen - {item.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Huidige voorraad</Label>
                                <div className="text-2xl font-bold">{item.stock_quantity || 0}</div>
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="stock-change">Voorraad wijziging</Label>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStockChange(prev => prev - 1)}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <Input
                                    id="stock-change"
                                    type="number"
                                    value={stockChange}
                                    onChange={(e) => setStockChange(Number(e.target.value))}
                                    className="text-center"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStockChange(prev => prev + 1)}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="notes">Notities</Label>
                                <Textarea
                                  id="notes"
                                  value={notes}
                                  onChange={(e) => setNotes(e.target.value)}
                                  placeholder="Reden voor voorraad wijziging..."
                                />
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleStockUpdate('purchase')}
                                  disabled={stockChange === 0 || updateStockMutation.isPending}
                                  className="flex-1"
                                >
                                  Aankoop
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleStockUpdate('adjustment')}
                                  disabled={stockChange === 0 || updateStockMutation.isPending}
                                  className="flex-1"
                                >
                                  Correctie
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StockManagement;