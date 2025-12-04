import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { signIn, signUp } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, User, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [chiroRole, setChiroRole] = useState('');
  const [loading, setLoading] = useState(false);
  // Wachtwoord reset state
  const [showReset, setShowReset] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [newPassword1, setNewPassword1] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [changeLoading, setChangeLoading] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const [existingGuests, setExistingGuests] = useState<any[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Luister naar Supabase recovery event om reset-formulier te tonen
  useEffect(() => {
    // Check if we're coming from a password recovery link
    const checkRecovery = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && window.location.hash.includes('type=recovery')) {
        setIsRecovery(true);
        setShowReset(false);
        toast({ title: 'Reset link bevestigd', description: 'Kies een nieuw wachtwoord.' });
      }
    };
    
    checkRecovery();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'TOKEN_REFRESHED' && session && window.location.hash.includes('type=recovery'))) {
        setIsRecovery(true);
        setShowReset(false);
        toast({ title: 'Reset link bevestigd', description: 'Kies een nieuw wachtwoord.' });
      }
    });
    return () => subscription.unsubscribe();
  }, [toast]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // First try to find user by email or username
    let loginEmail = email;
    
    // If it doesn't contain @, assume it's a username and find the email
    if (!email.includes('@')) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', email.toLowerCase())
        .maybeSingle();
      
      if (profileError || !profile) {
        toast({
          title: "Gebruiker niet gevonden",
          description: "Geen account gevonden met deze gebruikersnaam",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      loginEmail = profile.email;
    }

    const { error } = await signIn(loginEmail, password);
    
    if (error) {
      toast({
        title: "Inloggen mislukt",
        description: error.message === "Invalid login credentials" 
          ? "Onjuiste email/gebruikersnaam of wachtwoord" 
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welkom terug!",
        description: "Je bent succesvol ingelogd.",
      });
    }
    
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Check if email already exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (checkError) {
      toast({
        title: "Fout bij verificatie",
        description: "Er ging iets mis bij het controleren van je email.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (existingUsers) {
      toast({
        title: "Email al in gebruik",
        description: "Er bestaat al een account met dit email adres. Probeer in te loggen of gebruik een ander email adres.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Check if username already exists
    if (username) {
      const { data: existingUsername, error: usernameError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.toLowerCase())
        .maybeSingle();

      if (usernameError) {
        toast({
          title: "Fout bij verificatie",
          description: "Er ging iets mis bij het controleren van de gebruikersnaam.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (existingUsername) {
        toast({
          title: "Gebruikersnaam al in gebruik",
          description: "Deze gebruikersnaam is al bezet. Kies een andere gebruikersnaam.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }

    const { data, error } = await signUp(email, password, name);
    
    if (error) {
      toast({
        title: "Registratie mislukt",
        description: error.message === "User already registered" 
          ? "Er bestaat al een account met dit email adres" 
          : error.message,
        variant: "destructive",
      });
    } else {
      // Update chiro role and admin role if provided
      if (data.user) {
        const updates: any = {};
        
        if (chiroRole) {
          updates.chiro_role = chiroRole;
        }
        
        if (username) {
          updates.username = username.toLowerCase();
        }
        
        if (Object.keys(updates).length > 0) {
          const { error: roleError } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', data.user.id);
            
          if (roleError) {
            console.error('Error updating profile:', roleError);
          }
        }
      }
      
      toast({
        title: "Account aangemaakt!",
        description: "Je kunt nu inloggen met je nieuwe account.",
      });
      
      // Clear form
      setEmail('');
      setPassword('');
      setName('');
      setUsername('');
      setChiroRole('');
    }
    
    setLoading(false);
  };
  
  // Wachtwoord-reset e-mail versturen
  const handleSendResetEmail = async () => {
    if (!email) {
      toast({ title: 'Email vereist', description: 'Vul je email in om een reset link te ontvangen.', variant: 'destructive' });
      return;
    }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) {
      toast({ title: 'Kon reset e-mail niet versturen', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'E-mail verstuurd', description: 'Check je inbox voor de reset link.' });
      setShowReset(false);
    }
    setResetLoading(false);
  };

  // Nieuw wachtwoord instellen na recovery
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword1 !== newPassword2) {
      toast({ title: 'Wachtwoorden komen niet overeen', description: 'Beide wachtwoorden moeten gelijk zijn.', variant: 'destructive' });
      return;
    }
    if (newPassword1.length < 6) {
      toast({ title: 'Wachtwoord te kort', description: 'Minimaal 6 karakters.', variant: 'destructive' });
      return;
    }
    setChangeLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword1 });
    if (error) {
      toast({ title: 'Fout bij instellen wachtwoord', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Wachtwoord ingesteld', description: 'Je kunt nu inloggen met je nieuwe wachtwoord.' });
      setIsRecovery(false);
      setNewPassword1('');
      setNewPassword2('');
    }
    setChangeLoading(false);
  };

  const loadExistingGuests = async () => {
    setLoadingGuests(true);
    try {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('guest_account', true)
        .eq('occupied', true)
        .eq('active', true)
        .order('guest_number');
      
      if (error) throw error;
      
      // Calculate balances for existing guests
      const guestsWithBalances = await Promise.all(
        (data || []).map(async (guest: any) => {
          const { data: balance } = await (supabase as any)
            .rpc('calculate_user_balance', { user_uuid: guest.id });
          return { ...guest, balance: balance || 0 };
        })
      );
      
      setExistingGuests(guestsWithBalances);
    } catch (error) {
      console.error('Error loading existing guests:', error);
    } finally {
      setLoadingGuests(false);
    }
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      toast({
        title: "Naam vereist",
        description: "Vul je naam in om als gast in te loggen.",
        variant: "destructive",
      });
      return;
    }

    setGuestLoading(true);
    try {
      const { data: guestId, error } = await (supabase as any)
        .rpc('create_temp_guest_account', { _guest_name: guestName.trim() });
      
      if (error) throw error;

      toast({
        title: "Gastaccount aangemaakt",
        description: "Je wordt doorgestuurd naar je gastpagina.",
      });

      navigate(`/guest/${guestId}`);
    } catch (error: any) {
      console.error('Guest login error:', error);
      toast({
        title: "Fout",
        description: error.message || "Er ging iets mis bij het aanmaken van je gastaccount.",
        variant: "destructive",
      });
    } finally {
      setGuestLoading(false);
    }
  };

  const handleExistingGuestLogin = (guestId: string) => {
    navigate(`/guest/${guestId}`);
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md glass-card border-0">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <img 
              src="/lovable-uploads/11df38ab-3cdc-4bfc-8e71-a51ec8bef666.png" 
              alt="Chiro Logo" 
              className="h-16 w-16"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">Chiro Drinks</CardTitle>
          <CardDescription>
            Beheer je dranken saldo digitaal
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isRecovery ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-pass-1">Nieuw wachtwoord</Label>
                <Input
                  id="new-pass-1"
                  type="password"
                  value={newPassword1}
                  onChange={(e) => setNewPassword1(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pass-2">Bevestig nieuw wachtwoord</Label>
                <Input
                  id="new-pass-2"
                  type="password"
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={changeLoading}>
                {changeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Wachtwoord instellen
              </Button>
            </form>
          ) : (
            <Tabs defaultValue="signin" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="signin">Inloggen</TabsTrigger>
                <TabsTrigger value="signup">Registreren</TabsTrigger>
                <TabsTrigger value="guest">Gast</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email of Gebruikersnaam</Label>
                    <Input
                      id="email"
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jouw@email.be of gebruikersnaam"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Wachtwoord</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Inloggen
                  </Button>
                </form>
                <div className="mt-2 flex justify-end">
                  <Button variant="link" type="button" onClick={() => setShowReset((v) => !v)}>
                    Wachtwoord vergeten?
                  </Button>
                </div>
                {showReset && (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      We sturen een link naar je email om je wachtwoord te resetten.
                    </p>
                    <Button type="button" variant="outline" className="w-full" onClick={handleSendResetEmail} disabled={resetLoading || !email}>
                      {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Stuur reset e-mail
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Naam</Label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jouw volledige naam"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Gebruikersnaam</Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      placeholder="gebruikersnaam (optioneel)"
                      maxLength={20}
                    />
                    <p className="text-xs text-muted-foreground">
                      Alleen letters, cijfers en _ toegestaan. Laat leeg voor alleen email login.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jouw@email.be"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Wachtwoord</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                   <div className="space-y-2">
                     <Label htmlFor="chiro-role">Chiro Rol</Label>
                     <Select value={chiroRole} onValueChange={setChiroRole}>
                       <SelectTrigger>
                         <SelectValue placeholder="Kies je rol (optioneel)" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="leiding">Leiding</SelectItem>
                         <SelectItem value="vriend">Vriend</SelectItem>
                         <SelectItem value="oud-leiding">Oud-leiding</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                   
                   <Button type="submit" className="w-full" disabled={loading}>
                     {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                     Account aanmaken
                   </Button>
                 </form>
               </TabsContent>

                <TabsContent value="guest" className="space-y-6">
                  {/* Existing Guest Accounts */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <Label className="text-base font-semibold">Openstaande gastaccounts</Label>
                        <p className="text-sm text-muted-foreground">Login met een bestaand gastaccount</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={loadExistingGuests}
                        disabled={loadingGuests}
                        className="shrink-0"
                      >
                        {loadingGuests ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : "Ververs"}
                      </Button>
                    </div>
                    
                    {existingGuests.length > 0 ? (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {existingGuests.map((guest) => (
                          <div 
                            key={guest.id} 
                            className="group flex items-center justify-between p-4 border rounded-xl hover:shadow-md hover:border-primary/30 transition-all duration-200 bg-gradient-to-r from-card to-card/50"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{guest.occupied_by_name}</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-muted-foreground">
                                    Saldo: 
                                  </p>
                                  <Badge 
                                    variant={guest.balance < 0 ? "destructive" : "secondary"}
                                    className="text-xs"
                                  >
                                    {formatCurrency(guest.balance)}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              onClick={() => handleExistingGuestLogin(guest.id)}
                              className="group-hover:shadow-sm"
                            >
                              Inloggen
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                          <User className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          Geen openstaande gastaccounts
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Maak hieronder een nieuw gastaccount aan
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Create New Guest Account */}
                  <div className="border-t pt-6">
                    <div className="mb-4">
                      <Label className="text-base font-semibold">Nieuw gastaccount aanmaken</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Perfect voor bezoekers die nog geen account hebben
                      </p>
                    </div>
                    
                    <form onSubmit={handleGuestLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Input
                          id="guest-name"
                          type="text"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="Jouw volledige naam"
                          required
                          maxLength={50}
                          className="h-12"
                        />
                        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                          <div className="text-sm text-blue-800">
                            <p className="font-medium mb-1">Hoe werkt het?</p>
                            <ul className="text-xs space-y-1">
                              <li>• Bestel dranken zonder vooraf te betalen</li>
                              <li>• Reken achteraf af via bankoverschrijving</li>
                              <li>• Krijg een overzicht van al je bestellingen</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full h-12 text-base" 
                        disabled={guestLoading}
                      >
                        {guestLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <User className="mr-2 h-4 w-4" />
                        Gastaccount aanmaken
                      </Button>
                    </form>
                  </div>
                </TabsContent>
             </Tabs>
           )}

        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;