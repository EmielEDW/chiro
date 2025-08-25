import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Upload, Trash2 } from 'lucide-react';

const ProfileImageUpload = () => {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error('Niet ingelogd');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(fileName);
      
      // Update profile with new avatar URL
      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast({
        title: 'Profielfoto bijgewerkt',
        description: 'Je profielfoto is succesvol geüpload.',
      });
      setImageFile(null);
      setIsUploading(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Upload mislukt',
        description: error.message,
        variant: 'destructive',
      });
      setIsUploading(false);
    },
  });

  const removeImage = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Niet ingelogd');

      // Remove from storage
      const fileName = `${user.id}/avatar.${profile?.avatar_url?.split('.').pop() || 'jpg'}`;
      await supabase.storage
        .from('profile-avatars')
        .remove([fileName]);
      
      // Update profile to remove avatar URL
      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast({
        title: 'Profielfoto verwijderd',
        description: 'Je profielfoto is verwijderd.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Verwijderen mislukt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleUpload = async () => {
    if (!imageFile) return;
    
    setIsUploading(true);
    uploadImage.mutate(imageFile);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="text-lg">
            {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-2">
          <Label htmlFor="avatar-upload">Profielfoto</Label>
          <div className="flex items-center gap-2">
            <Input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="flex-1"
            />
            <Button
              onClick={handleUpload}
              disabled={!imageFile || isUploading}
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
            {profile?.avatar_url && (
              <Button
                onClick={() => removeImage.mutate()}
                disabled={removeImage.isPending}
                variant="outline"
                size="sm"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Upload een profielfoto (JPG, PNG). Maximum bestandsgrootte: 5MB.
      </p>
    </div>
  );
};

export default ProfileImageUpload;