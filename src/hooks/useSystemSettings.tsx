import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  description: string | null;
}

export const useSystemSettings = () => {
  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (error) throw error;
      return data as SystemSetting[];
    },
  });

  const getSetting = (key: string, defaultValue: any = null) => {
    const setting = settings.find(s => s.setting_key === key);
    return setting ? setting.setting_value : defaultValue;
  };

  const lateFeeSetting = getSetting('late_fee_enabled', true);
  const isLateFeeEnabled = lateFeeSetting === true || lateFeeSetting === 'true';

  return {
    settings,
    isLoading,
    getSetting,
    isLateFeeEnabled,
  };
};
