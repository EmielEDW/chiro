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
import { Loader2 } from 'lucide-react';
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <Card className="w-full max-w-md">
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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Inloggen</TabsTrigger>
                <TabsTrigger value="signup">Registreren</TabsTrigger>
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
            </Tabs>
          )}

        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;