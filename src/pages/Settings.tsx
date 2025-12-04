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
  const [loading, setLoading] = useState(false);
  const [upgradeToAdmin, setUpgradeToAdmin] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

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

  const handleAdminUpgrade = async () => {
    if (!upgradeToAdmin || !adminPassword) return;
    
    // Check the special admin password
    if (adminPassword !== 'Drankenman123!') {
      toast({
        title: "Onjuist wachtwoord",
        description: "Het admin wachtwoord is niet correct.",
        variant: "destructive",
      });
      setAdminPassword('');
      return;
    }
    
    setUpgradeLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: "Account geüpgraded",
        description: "Je account heeft nu admin rechten.",
      });

      // Refresh profile data
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      setUpgradeToAdmin(false);
      setAdminPassword('');
    } catch (error: any) {
      toast({
        title: "Fout bij upgraden",
        description: error.message || "Er ging iets mis bij het upgraden van je account.",
        variant: "destructive",
      });
    }

    setUpgradeLoading(false);
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
            
            {/* Admin Upgrade Option - only show if not already admin */}
            {profile.role !== 'admin' && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <Checkbox 
                      id="admin-upgrade" 
                      checked={upgradeToAdmin}
                      onCheckedChange={(checked) => setUpgradeToAdmin(checked === true)}
                    />
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-amber-600" />
                      <Label htmlFor="admin-upgrade" className="text-sm font-medium text-amber-800">
                        Upgrade naar admin rechten (alleen voor beheerders)
                      </Label>
                    </div>
                  </div>
                  
                  {upgradeToAdmin && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="admin-password">Admin wachtwoord</Label>
                        <div className="relative">
                          <Input
                            id="admin-password"
                            type={showAdminPassword ? "text" : "password"}
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            placeholder="Voer het admin wachtwoord in"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                          >
                            {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Dit wachtwoord is alleen bekend bij de beheerders
                        </p>
                      </div>
                      
                      <Button 
                        onClick={handleAdminUpgrade}
                        disabled={upgradeLoading || !adminPassword}
                        variant="outline"
                        className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                      >
                        {upgradeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Shield className="mr-2 h-4 w-4" />
                        Account upgraden naar admin
                      </Button>
                    </div>
                  )}
                </div>
                <Separator />
              </>
            )}
            
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