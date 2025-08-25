import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Upload } from 'lucide-react';

interface Item {
  id: string;
  name: string;
  price_cents: number;
  purchase_price_cents: number;
  description?: string;
  category?: string;
  image_url?: string;
  stock_quantity?: number;
  active: boolean;
  created_at: string;
}

const ProductManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price_cents: '',
    purchase_price_cents: '',
    description: '',
    category: '',
    stock_quantity: '',
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Item[];
    },
  });

  const createItem = useMutation({
    mutationFn: async (itemData: any) => {
      let imageUrl = null;
      
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }
      
      const { data, error } = await supabase
        .from('items')
        .insert({
          ...itemData,
          image_url: imageUrl,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast({ title: 'Product toegevoegd', description: 'Het product is succesvol toegevoegd.' });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...itemData }: { id: string } & any) => {
      let imageUrl = editingItem?.image_url;
      
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }
      
      const { data, error } = await supabase
        .from('items')
        .update({
          ...itemData,
          image_url: imageUrl,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast({ title: 'Product bijgewerkt', description: 'Het product is succesvol bijgewerkt.' });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('items')
        .update({ active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast({ title: 'Product verwijderd', description: 'Het product is gedeactiveerd.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      price_cents: '',
      purchase_price_cents: '',
      description: '',
      category: '',
      stock_quantity: '',
    });
    setEditingItem(null);
    setImageFile(null);
  };

  const openEditDialog = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price_cents: item.price_cents.toString(),
      purchase_price_cents: item.purchase_price_cents?.toString() || '0',
      description: item.description || '',
      category: item.category || '',
      stock_quantity: item.stock_quantity?.toString() || '0',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const itemData = {
      name: formData.name,
      price_cents: parseInt(formData.price_cents),
      purchase_price_cents: parseInt(formData.purchase_price_cents),
      description: formData.description || null,
      category: formData.category || null,
      stock_quantity: parseInt(formData.stock_quantity) || 0,
      active: true,
    };

    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, ...itemData });
    } else {
      createItem.mutate(itemData);
    }
  };

  const formatCurrency = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  const getCategoryBadge = (category: string | null) => {
    if (!category) return <Badge variant="outline">Geen categorie</Badge>;
    
    const variants: Record<string, any> = {
      drinks: 'default',
      food: 'secondary',
      alcohol: 'destructive',
      other: 'outline',
    };
    
    return <Badge variant={variants[category] || 'outline'}>{category}</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product beheer</CardTitle>
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
        <CardTitle className="flex items-center justify-between">
          Product beheer
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Product toevoegen
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? 'Product bewerken' : 'Nieuw product'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Naam *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Categorie</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer categorie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="drinks">Dranken</SelectItem>
                        <SelectItem value="food">Voedsel</SelectItem>
                        <SelectItem value="alcohol">Alcohol</SelectItem>
                        <SelectItem value="other">Overige</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Verkoopprijs (centen) *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price_cents}
                      onChange={(e) => setFormData({ ...formData, price_cents: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="purchase_price">Inkoopprijs (centen)</Label>
                    <Input
                      id="purchase_price"
                      type="number"
                      value={formData.purchase_price_cents}
                      onChange={(e) => setFormData({ ...formData, purchase_price_cents: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="stock">Voorraad</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Beschrijving</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="image">Productafbeelding</Label>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Annuleren
                  </Button>
                  <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
                    {editingItem ? 'Bijwerken' : 'Toevoegen'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Categorie</TableHead>
                <TableHead>Verkoopprijs</TableHead>
                <TableHead>Inkoopprijs</TableHead>
                <TableHead>Winst</TableHead>
                <TableHead>Voorraad</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const profit = item.price_cents - (item.purchase_price_cents || 0);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="h-10 w-10 rounded object-cover"
                          />
                        )}
                        <div>
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getCategoryBadge(item.category)}</TableCell>
                    <TableCell>{formatCurrency(item.price_cents)}</TableCell>
                    <TableCell>{formatCurrency(item.purchase_price_cents || 0)}</TableCell>
                    <TableCell className={profit >= 0 ? 'text-success' : 'text-destructive'}>
                      {formatCurrency(profit)}
                    </TableCell>
                    <TableCell>{item.stock_quantity || 0}</TableCell>
                    <TableCell>
                      <Badge variant={item.active ? 'default' : 'secondary'}>
                        {item.active ? 'Actief' : 'Inactief'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteItem.mutate(item.id)}
                          disabled={!item.active}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductManagement;