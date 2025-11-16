import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export const SystemSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (error) throw error;
      return data;
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          setting_value: value,
          updated_by: user?.id 
        })
        .eq('setting_key', key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast({
        title: "Instelling bijgewerkt",
        description: "De wijziging is opgeslagen",
      });
    },
    onError: (error) => {
      toast({
        title: "Fout bij opslaan",
        description: error instanceof Error ? error.message : "Er is iets misgegaan",
        variant: "destructive",
      });
    },
  });

  const lateFeeSetting = settings.find(s => s.setting_key === 'late_fee_enabled');
  const lateFeeEnabled = lateFeeSetting?.setting_value === true || lateFeeSetting?.setting_value === 'true';

  const handleLateFeeToggle = (enabled: boolean) => {
    updateSettingMutation.mutate({
      key: 'late_fee_enabled',
      value: enabled,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Systeem Instellingen</CardTitle>
        <CardDescription>
          Beheer algemene applicatie instellingen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="late-fee-toggle">Te laat functie</Label>
            <p className="text-sm text-muted-foreground">
              Schakel de te laat knop en statistieken in of uit
            </p>
          </div>
          <Switch
            id="late-fee-toggle"
            checked={lateFeeEnabled}
            onCheckedChange={handleLateFeeToggle}
            disabled={updateSettingMutation.isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
};
