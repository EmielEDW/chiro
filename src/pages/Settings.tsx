import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueryClient } from '@tanstack/react-query';
import ProfileImageUpload from '@/components/ProfileImageUpload';

const Settings = () => {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState(profile?.name || '');
  const [chiroRole, setChiroRole] = useState(profile?.chiro_role || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [adminUpgrade, setAdminUpgrade] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateProfile.mutateAsync({
        name,
        chiro_role: chiroRole,
      });

      toast({
        title: "Profiel bijgewerkt",
        description: "Je profielgegevens zijn succesvol bijgewerkt.",
      });
    } catch (error) {
      toast({
        title: "Fout",
        description: "Er ging iets mis bij het bijwerken van je profiel.",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Wachtwoorden komen niet overeen",
        description: "Het nieuwe wachtwoord en bevestiging moeten identiek zijn.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Wachtwoord te kort",
        description: "Het wachtwoord moet minstens 6 karakters lang zijn.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Wachtwoord gewijzigd",
        description: "Je wachtwoord is succesvol gewijzigd.",
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: "Fout bij wachtwoord wijzigen",
        description: error.message || "Er ging iets mis bij het wijzigen van je wachtwoord.",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const handleAdminUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('upgrade_to_admin', {
        _user_id: user?.id,
        _admin_password: adminPassword
      });

      if (error) throw error;
      
      if (!data) {
        toast({
          title: "Admin upgrade mislukt",
          description: "Onjuist admin wachtwoord. Contacteer de beheerder voor toegang.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });

      toast({
        title: "Admin rechten toegekend!",
        description: "Je account heeft nu admin rechten. Herlaad de pagina om alle functies te zien.",
      });

      setAdminUpgrade(false);
      setAdminPassword('');
    } catch (error: any) {
      toast({
        title: "Fout bij admin upgrade",
        description: error.message || "Er ging iets mis bij het toekennen van admin rechten.",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  if (!profile) {
    return <div className="text-center py-8">Laden...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Terug
          </Button>
          <div className="flex items-center gap-3">
            <img 
              src="/lovable-uploads/11df38ab-3cdc-4bfc-8e71-a51ec8bef666.png" 
              alt="Chiro Logo" 
              className="h-8 w-8"
            />
            <h1 className="text-2xl font-bold text-primary">Account Instellingen</h1>
          </div>
        </div>

        {/* Profile Picture & Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Profiel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <ProfileImageUpload />
              
              <Separator />
              
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Naam</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jouw naam"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="chiro-role">Chiro functie</Label>
                    <Select value={chiroRole} onValueChange={setChiroRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Kies je rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="leiding">Leiding</SelectItem>
                        <SelectItem value="vriend">Vriend</SelectItem>
                        <SelectItem value="oud-leiding">Oud-leiding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email kan niet gewijzigd worden
                  </p>
                </div>

                <Button type="submit" disabled={loading || updateProfile.isPending}>
                  {(loading || updateProfile.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Profiel opslaan
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle>Wachtwoord wijzigen</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Huidig wachtwoord</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showPasswords ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPasswords(!showPasswords)}
                  >
                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">Nieuw wachtwoord</Label>
                <Input
                  id="new-password"
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Bevestig nieuw wachtwoord</Label>
                <Input
                  id="confirm-password"
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>

              <Button 
                type="submit" 
                disabled={loading || !newPassword || !confirmPassword}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Wachtwoord wijzigen
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Admin Upgrade */}
        {profile.role !== 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Admin rechten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Heb je admin toegang gekregen? Upgrade je account naar admin rechten.
                </p>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="admin-upgrade" 
                    checked={adminUpgrade}
                    onCheckedChange={(checked) => {
                      setAdminUpgrade(checked as boolean);
                      if (!checked) setAdminPassword('');
                    }}
                  />
                  <Label htmlFor="admin-upgrade" className="text-sm">
                    Ik wil admin rechten aanvragen
                  </Label>
                </div>

                {adminUpgrade && (
                  <form onSubmit={handleAdminUpgrade} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="admin-password-upgrade">Admin wachtwoord</Label>
                      <Input
                        id="admin-password-upgrade"
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Voer admin wachtwoord in"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Contacteer de beheerder voor het admin wachtwoord
                      </p>
                    </div>

                    <Button type="submit" disabled={loading || !adminPassword}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Admin rechten activeren
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Role Display */}
        <Card>
          <CardHeader>
            <CardTitle>Account informatie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Huidige rol:</span>
              <span className={`text-sm px-2 py-1 rounded ${
                profile.role === 'admin' ? 'bg-destructive/10 text-destructive' :
                profile.role === 'treasurer' ? 'bg-primary/10 text-primary' :
                'bg-muted text-muted-foreground'
              }`}>
                {profile.role === 'admin' ? 'Admin' :
                 profile.role === 'treasurer' ? 'Penningmeester' : 'Gebruiker'}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Credit toegestaan:</span>
              <span className="text-sm">
                {profile.allow_credit ? 'Ja' : 'Nee'}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Lid sinds:</span>
              <span className="text-sm">
                {new Date(profile.created_at).toLocaleDateString('nl-BE')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;