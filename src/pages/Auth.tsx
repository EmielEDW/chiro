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

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: "Inloggen mislukt",
        description: error.message === "Invalid login credentials" 
          ? "Onjuiste email of wachtwoord" 
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

    const { error } = await signUp(email, password, name);
    
    if (error) {
      toast({
        title: "Registratie mislukt",
        description: error.message === "User already registered" 
          ? "Er bestaat al een account met dit email adres" 
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account aangemaakt!",
        description: "Je kunt nu inloggen met je nieuwe account.",
      });
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Chiro Drinks</CardTitle>
          <CardDescription>
            Beheer je dranken saldo digitaal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Inloggen</TabsTrigger>
              <TabsTrigger value="signup">Registreren</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jouw@email.be"
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
                    placeholder="Jouw naam"
                    required
                  />
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
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Account aanmaken
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;