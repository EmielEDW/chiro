import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Category {
  slug: string;
  name: string;
  color: string;
  sort_order: number;
  is_protected: boolean;
}

export function useCategories() {
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("slug, name, color, sort_order, is_protected")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const bySlug = new Map<string, Category>();
  for (const cat of query.data ?? []) bySlug.set(cat.slug, cat);

  return {
    categories: query.data ?? [],
    bySlug,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
