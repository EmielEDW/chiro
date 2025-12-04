import { useState, useEffect } from 'react';
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
import { Plus, Edit, Trash2, Upload, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';

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
  created_at: string;
}

interface MixedDrinkComponent {
  id?: string;
  component_item_id: string;
  quantity: number;
  component_name?: string;
}

const getCategoryOrder = (category?: string) => {
  switch (category) {
    case 'frisdranken': return 1;
    case 'bieren': return 2;
    case 'sterke_dranken': return 3;
    case 'mixed_drinks': return 4;
    case 'chips': return 5;
    case 'andere': return 6;
    default: return 7;
  }
};

const ProductManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<MixedDrinkComponent[]>([]);
  
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

  // Query voor alle items die gebruikt kunnen worden als componenten
  const { data: availableComponents = [] } = useQuery({
    queryKey: ['available-components'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('active', true)
        .neq('category', 'mixed_drinks')
        .order('name');
      
      if (error) throw error;
      return data as Item[];
    },
  });

  // Query voor bestaande componenten van een mixed drink (alleen bij bewerken)
  const { data: existingComponents = [] } = useQuery({
    queryKey: ['mixed-drink-components', editingItem?.id],
    queryFn: async () => {
      if (!editingItem?.id || editingItem.category !== 'mixed_drinks') return [];
      
      const { data, error } = await supabase
        .from('mixed_drink_components')
        .select(`
          id,
          component_item_id,
          quantity,
          component_item:items!component_item_id (
            id,
            name,
            price_cents,
            purchase_price_cents
          )
        `)
        .eq('mixed_drink_id', editingItem.id);
      
      if (error) throw error;
      
      return data.map(component => ({
        id: component.id,
        component_item_id: component.component_item_id,
        quantity: component.quantity,
        component_name: component.component_item?.name || 'Onbekend item'
      }));
    },
    enabled: !!editingItem?.id && editingItem.category === 'mixed_drinks',
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
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast({ title: 'Product verwijderd', description: 'Het product is permanent verwijderd.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation voor het opslaan van mixed drink componenten
  const saveMixedDrinkComponents = useMutation({
    mutationFn: async ({ mixedDrinkId, components }: { mixedDrinkId: string; components: MixedDrinkComponent[] }) => {
      // Eerst alle bestaande componenten verwijderen
      await supabase
        .from('mixed_drink_components')
        .delete()
        .eq('mixed_drink_id', mixedDrinkId);
      
      // Dan nieuwe componenten toevoegen
      if (components.length > 0) {
        const { error } = await supabase
          .from('mixed_drink_components')
          .insert(
            components.map(component => ({
              mixed_drink_id: mixedDrinkId,
              component_item_id: component.component_item_id,
              quantity: component.quantity,
            }))
          );
        
        if (error) throw error;
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Fout bij opslaan componenten',
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
    setSelectedComponents([]);
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

  // Effect om bestaande componenten te laden bij mixed drinks
  useEffect(() => {
    if (editingItem?.category === 'mixed_drinks' && existingComponents.length > 0) {
      setSelectedComponents(existingComponents);
    } else if (formData.category !== 'mixed_drinks') {
      setSelectedComponents([]);
    }
  }, [editingItem?.category, existingComponents, formData.category]);

  // Helper functions voor component management
  const addComponent = () => {
    setSelectedComponents([...selectedComponents, {
      component_item_id: '',
      quantity: 1,
      component_name: ''
    }]);
  };

  const removeComponent = (index: number) => {
    setSelectedComponents(selectedComponents.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, field: keyof MixedDrinkComponent, value: string | number) => {
    const updated = [...selectedComponents];
    if (field === 'component_item_id') {
      const selectedItem = availableComponents.find(item => item.id === value);
      updated[index] = {
        ...updated[index],
        component_item_id: value as string,
        component_name: selectedItem?.name || ''
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setSelectedComponents(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validatie voor mixed drinks
    if (formData.category === 'mixed_drinks' && selectedComponents.length === 0) {
      toast({
        title: 'Fout',
        description: 'Mixed drinks moeten minimaal één component hebben.',
        variant: 'destructive',
      });
      return;
    }

    // Valideer componenten voor mixed drinks
    if (formData.category === 'mixed_drinks') {
      const hasInvalidComponents = selectedComponents.some(
        component => !component.component_item_id || component.quantity <= 0
      );
      
      if (hasInvalidComponents) {
        toast({
          title: 'Fout',
          description: 'Alle componenten moeten geldig zijn met quantity > 0.',
          variant: 'destructive',
        });
        return;
      }
    }
    
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
      let itemId: string;
      
      if (editingItem) {
        const result = await updateItem.mutateAsync({ id: editingItem.id, ...itemData });
        itemId = result.id;
      } else {
        const result = await createItem.mutateAsync(itemData);
        itemId = result.id;
      }

      // Sla componenten op voor mixed drinks
      if (formData.category === 'mixed_drinks' && selectedComponents.length > 0) {
        await saveMixedDrinkComponents.mutateAsync({
          mixedDrinkId: itemId,
          components: selectedComponents,
        });
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['available-components'] });
      queryClient.invalidateQueries({ queryKey: ['mixed-drink-components'] });
      
      toast({ 
        title: editingItem ? 'Product bijgewerkt' : 'Product toegevoegd', 
        description: formData.category === 'mixed_drinks' 
          ? 'Mixed drink en componenten succesvol opgeslagen.' 
          : 'Het product is succesvol opgeslagen.' 
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

  const getCategoryBadge = (category: string | null) => {
    if (!category) return <Badge variant="outline">Geen categorie</Badge>;
    
    return <Badge variant="secondary" className={getCategoryColor(category)}>
      {getCategoryName(category)}
    </Badge>;
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
                        <SelectItem value="chips">Chips</SelectItem>
                        <SelectItem value="frisdranken">Frisdranken</SelectItem>
                        <SelectItem value="bieren">Bieren</SelectItem>
                        <SelectItem value="sterke_dranken">Sterke dranken</SelectItem>
                        <SelectItem value="mixed_drinks">Mixed Drinks</SelectItem>
                        <SelectItem value="andere">Andere</SelectItem>
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

                {/* Mixed Drinks Componenten Sectie */}
                {formData.category === 'mixed_drinks' && (
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Componenten *</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addComponent}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Component toevoegen
                      </Button>
                    </div>
                    
                    {selectedComponents.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        Voeg componenten toe voor deze mixed drink
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedComponents.map((component, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 border rounded bg-background">
                            <div className="flex-1">
                              <Select
                                value={component.component_item_id}
                                onValueChange={(value) => updateComponent(index, 'component_item_id', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecteer ingredient" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableComponents.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {item.name} - {formatCurrency(item.price_cents)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-20">
                              <Input
                                type="number"
                                min="1"
                                value={component.quantity}
                                onChange={(e) => updateComponent(index, 'quantity', parseInt(e.target.value) || 1)}
                                placeholder="Aantal"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeComponent(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {selectedComponents.length > 0 && (
                      <div className="text-sm text-muted-foreground bg-background p-3 rounded border">
                        <div className="font-medium mb-2">Berekende prijzen:</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            Inkoopprijs: <span className="font-medium">
                              {formatCurrency(
                                selectedComponents.reduce((total, comp) => {
                                  const item = availableComponents.find(i => i.id === comp.component_item_id);
                                  return total + ((item?.purchase_price_cents || 0) * comp.quantity);
                                }, 0)
                              )}
                            </span>
                          </div>
                          <div>
                            Verkoopprijs: <span className="font-medium">
                              {formatCurrency(
                                selectedComponents.reduce((total, comp) => {
                                  const item = availableComponents.find(i => i.id === comp.component_item_id);
                                  return total + ((item?.price_cents || 0) * comp.quantity);
                                }, 0)
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                .sort((a, b) => getCategoryOrder(a.category) - getCategoryOrder(b.category))
                .map((item) => (
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
                      <span className="font-medium">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getCategoryBadge(item.category)}</TableCell>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteItem.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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