import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Archive, RotateCcw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useCategories } from '@/hooks/useCategories';
import { categoryBadgeClass } from '@/lib/categoryColors';

interface Item {
  id: string;
  name: string;
  price_cents: number;
  purchase_price_cents: number;
  description?: string;
  category?: string;
  image_url?: string;
  stock_quantity?: number;
  notify_on_low_stock?: boolean;
  active: boolean;
  created_at: string;
}

const ProductManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { categories, bySlug } = useCategories();

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
    notify_on_low_stock: true,
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

  const archiveItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('items')
        .update({ active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast({
        title: 'Product gearchiveerd',
        description: 'Het product is verborgen voor leden. History blijft behouden.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const reactivateItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('items')
        .update({ active: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast({
        title: 'Product heractiveerd',
        description: 'Het product is weer zichtbaar voor leden.',
      });
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
      notify_on_low_stock: true,
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
      notify_on_low_stock: item.notify_on_low_stock ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const itemData = {
      name: formData.name,
      price_cents: parseInt(formData.price_cents),
      purchase_price_cents: parseInt(formData.purchase_price_cents),
      description: formData.description || null,
      category: formData.category || null,
      stock_quantity: parseInt(formData.stock_quantity) || 0,
      notify_on_low_stock: formData.notify_on_low_stock,
      active: true,
    };

    try {
      if (editingItem) {
        await updateItem.mutateAsync({ id: editingItem.id, ...itemData });
      } else {
        await createItem.mutateAsync(itemData);
      }

      queryClient.invalidateQueries({ queryKey: ['admin-products'] });

      toast({
        title: editingItem ? 'Product bijgewerkt' : 'Product toegevoegd',
        description: 'Het product is succesvol opgeslagen.',
      });

      resetForm();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  const getCategoryBadge = (slug: string | null) => {
    if (!slug) return <Badge variant="outline">Geen categorie</Badge>;
    const cat = bySlug.get(slug);
    return (
      <Badge variant="secondary" className={categoryBadgeClass(cat?.color)}>
        {cat?.name ?? 'Overig'}
      </Badge>
    );
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
                <DialogTitle>Product {editingItem ? 'bewerken' : 'toevoegen'}</DialogTitle>
                <DialogDescription>
                  {editingItem ? 'Bewerk de gegevens van dit product.' : 'Voeg een nieuw product toe aan de catalogus.'}
                </DialogDescription>
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
                      <SelectTrigger className="bg-background border z-50">
                        <SelectValue placeholder="Selecteer categorie" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg">
                        {categories.map((cat) => (
                          <SelectItem key={cat.slug} value={cat.slug}>
                            {cat.name}
                          </SelectItem>
                        ))}
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

                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-0.5">
                    <Label htmlFor="notify_low_stock" className="text-base">
                      Lage voorraad melding
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Toon waarschuwing bij lage voorraad in admin dashboard
                    </p>
                  </div>
                  <Switch
                    id="notify_low_stock"
                    checked={formData.notify_on_low_stock}
                    onCheckedChange={(checked) => setFormData({ ...formData, notify_on_low_stock: checked })}
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
                <TableHead>Voorraad</TableHead>
                <TableHead>Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...items]
                .sort((a, b) => {
                  const orderA = (a.category && bySlug.get(a.category)?.sort_order) ?? 9999;
                  const orderB = (b.category && bySlug.get(b.category)?.sort_order) ?? 9999;
                  return orderA - orderB;
                })
                .map((item) => (
                <TableRow key={item.id} className={item.active ? '' : 'opacity-50 bg-muted/30'}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      )}
                      <span className="font-medium">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getCategoryBadge(item.category)}
                      {!item.active && (
                        <Badge variant="outline" className="text-xs">
                          Gearchiveerd
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{item.stock_quantity || 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {item.active ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (window.confirm(`"${item.name}" archiveren? Het verdwijnt uit het menu maar history blijft behouden.`)) {
                              archiveItem.mutate(item.id);
                            }
                          }}
                          title="Archiveren"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => reactivateItem.mutate(item.id)}
                          title="Heractiveren"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductManagement;
