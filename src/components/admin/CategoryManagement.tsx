import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, Category } from "@/hooks/useCategories";
import {
  CATEGORY_COLOR_KEYS,
  CategoryColorKey,
  categoryBadgeClass,
  categorySwatchClass,
  isValidColorKey,
} from "@/lib/categoryColors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Edit, Lock, Plus, Trash2 } from "lucide-react";

interface FormState {
  name: string;
  color: CategoryColorKey;
  sort_order: string;
}

const EMPTY_FORM: FormState = { name: "", color: "blue", sort_order: "100" };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const CategoryManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { categories, isLoading } = useCategories();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: counts = {} } = useQuery({
    queryKey: ["category-product-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("items")
        .select("category");
      if (error) throw error;
      const result: Record<string, number> = {};
      for (const row of data ?? []) {
        const slug = row.category ?? "__null__";
        result[slug] = (result[slug] ?? 0) + 1;
      }
      return result;
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      color: isValidColorKey(cat.color) ? cat.color : "gray",
      sort_order: String(cat.sort_order),
    });
    setIsOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const slug = slugify(form.name);
      if (!slug) throw new Error("Geef een geldige naam op.");
      const { error } = await supabase.from("categories").insert({
        slug,
        name: form.name.trim(),
        color: form.color,
        sort_order: parseInt(form.sort_order, 10) || 100,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Een categorie met deze naam bestaat al.");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["category-product-counts"] });
      toast({ title: "Categorie aangemaakt" });
      setIsOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("categories")
        .update({
          name: form.name.trim(),
          color: form.color,
          sort_order: parseInt(form.sort_order, 10) || 100,
        })
        .eq("slug", editing.slug);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Categorie bijgewerkt" });
      setIsOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: async (slug: string) => {
      const { error } = await supabase.from("categories").delete().eq("slug", slug);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["category-product-counts"] });
      toast({ title: "Categorie verwijderd" });
    },
    onError: (e: Error) => {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    },
  });

  const onDelete = (cat: Category) => {
    const count = counts[cat.slug] ?? 0;
    if (count > 0) {
      toast({
        title: "Kan niet verwijderen",
        description: `Er zijn nog ${count} producten in deze categorie. Verplaats die eerst.`,
        variant: "destructive",
      });
      return;
    }
    if (!window.confirm(`Categorie "${cat.name}" verwijderen?`)) return;
    remove.mutate(cat.slug);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (editing) update.mutate();
    else create.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Categorieën</CardTitle>
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
          Categorieën
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe categorie
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Categorie bewerken" : "Nieuwe categorie"}
                </DialogTitle>
                <DialogDescription>
                  {editing
                    ? "Pas naam, kleur of volgorde aan."
                    : "Geef een naam, kleur en sorteervolgorde."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="cat-name">Naam *</Label>
                  <Input
                    id="cat-name"
                    maxLength={40}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                {editing && (
                  <div>
                    <Label>Slug</Label>
                    <Input value={editing.slug} readOnly disabled />
                  </div>
                )}
                <div>
                  <Label>Kleur</Label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {CATEGORY_COLOR_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        aria-label={key}
                        onClick={() => setForm({ ...form, color: key })}
                        className={`h-8 w-8 rounded-full ${categorySwatchClass(key)} ${
                          form.color === key
                            ? "ring-2 ring-offset-2 ring-foreground"
                            : ""
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="cat-order">Sorteervolgorde</Label>
                  <Input
                    id="cat-order"
                    type="number"
                    min={0}
                    value={form.sort_order}
                    onChange={(e) =>
                      setForm({ ...form, sort_order: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Lager = eerder in de lijst.
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                  >
                    Annuleren
                  </Button>
                  <Button
                    type="submit"
                    disabled={create.isPending || update.isPending || !form.name.trim()}
                  >
                    {editing ? "Bijwerken" : "Aanmaken"}
                  </Button>
                </DialogFooter>
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
                <TableHead>Volgorde</TableHead>
                <TableHead>Naam</TableHead>
                <TableHead>Kleur</TableHead>
                <TableHead>Producten</TableHead>
                <TableHead>Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.slug}>
                  <TableCell>{cat.sort_order}</TableCell>
                  <TableCell className="flex items-center gap-2">
                    {cat.name}
                    {cat.is_protected && (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={categoryBadgeClass(cat.color)}>
                      {cat.color}
                    </Badge>
                  </TableCell>
                  <TableCell>{counts[cat.slug] ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(cat)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cat.is_protected}
                        onClick={() => onDelete(cat)}
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

export default CategoryManagement;
