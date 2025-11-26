import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { StickyNote } from "lucide-react";

export const AdminNotepad = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  const { data: savedNotes, isLoading } = useQuery({
    queryKey: ["admin-notepad"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "admin_notepad")
        .maybeSingle();

      if (error) throw error;
      return data?.setting_value as string || "";
    },
  });

  useEffect(() => {
    if (savedNotes !== undefined) {
      setNotes(savedNotes);
    }
  }, [savedNotes]);

  const saveMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("setting_key", "admin_notepad")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("system_settings")
          .update({
            setting_value: newNotes,
            updated_at: new Date().toISOString(),
          })
          .eq("setting_key", "admin_notepad");

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("system_settings")
          .insert({
            setting_key: "admin_notepad",
            setting_value: newNotes,
            description: "Admin notitieblok voor drankensysteem",
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notepad"] });
    },
    onError: (error) => {
      toast({
        title: "Fout bij opslaan",
        description: "Kon notities niet opslaan. Probeer opnieuw.",
        variant: "destructive",
      });
      console.error("Error saving notes:", error);
    },
  });

  const handleNotesChange = (value: string) => {
    setNotes(value);

    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Set new timeout to save after 1 second of no typing
    const timeout = setTimeout(() => {
      saveMutation.mutate(value);
    }, 1000);

    setSaveTimeout(timeout);
  };

  if (isLoading) {
    return <div>Laden...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="h-5 w-5" />
          Notitieblok
        </CardTitle>
        <CardDescription>
          Snel notities maken over het drankensysteem (wordt automatisch opgeslagen)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Type hier je notities..."
          className="min-h-[200px] resize-y"
        />
        {saveMutation.isPending && (
          <p className="text-xs text-muted-foreground mt-2">Opslaan...</p>
        )}
      </CardContent>
    </Card>
  );
};
