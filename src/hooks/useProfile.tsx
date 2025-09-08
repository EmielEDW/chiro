import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGuestAuth } from '@/hooks/useGuestAuth';
import { signOut } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'treasurer' | 'admin';
  chiro_role?: string;
  username?: string;
  avatar_url?: string;
  active: boolean;
  allow_credit: boolean;
  created_at: string;
}

export const useProfile = () => {
  const { user } = useAuth();
  const { guestUser } = useGuestAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const currentUserId = user?.id || guestUser?.id;

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return null;
      
      // For guest users, try to get their actual profile from the database
      if (guestUser) {
        const { data: guestProfile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', guestUser.id)
          .single();
        
        if (guestProfile && !error) {
          return guestProfile as Profile;
        }
        
        // Fallback to mock profile if not found
        return {
          id: guestUser.id,
          name: guestUser.name,
          email: `guest_${guestUser.id}@chiro.local`,
          role: 'user' as const,
          chiro_role: null,
          username: null,
          avatar_url: null,
          active: true,
          allow_credit: true,
          created_at: new Date().toISOString(),
        } as Profile;
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUserId)
        .single();
      
      // If profile doesn't exist or is inactive, sign out
      if (error && error.code === 'PGRST116') {
        console.log('Profile not found, signing out');
        await signOut();
        navigate('/auth');
        return null;
      }
      
      if (error) throw error;
      
      // If profile is inactive, sign out
      if (data && !data.active) {
        console.log('Profile is inactive, signing out');
        await signOut();
        navigate('/auth');
        return null;
      }
      
      return data as Profile;
    },
    enabled: !!currentUserId,
    retry: false,
  });

  const { data: balance } = useQuery({
    queryKey: ['balance', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return 0;
      
      const { data, error } = await supabase
        .rpc('calculate_user_balance', { user_uuid: currentUserId });
      
      if (error) throw error;
      return data as number;
    },
    enabled: !!currentUserId,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!currentUserId || guestUser) throw new Error('Cannot update guest profile');
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentUserId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', currentUserId] });
    },
  });

  const refreshBalance = () => {
    queryClient.invalidateQueries({ queryKey: ['balance', currentUserId] });
  };

  return {
    profile,
    balance: balance || 0,
    isLoading,
    updateProfile,
    refreshBalance,
  };
};