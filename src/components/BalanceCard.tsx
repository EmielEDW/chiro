import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, Plus } from 'lucide-react';

interface BalanceCardProps {
  balance: number;
  onTopUp: () => void;
}

const BalanceCard = ({ balance, onTopUp }: BalanceCardProps) => {
  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const getBalanceColor = () => {
    if (balance > 500) return 'text-primary';
    return 'text-yellow-600';
  };

  const getBalanceBadge = () => {
    if (balance > 500) return { variant: 'default' as const, text: 'Goed saldo' };
    return { variant: 'secondary' as const, text: 'Laag saldo' };
  };

  const badge = getBalanceBadge();

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-accent/5 hover-lift smooth-transition">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Jouw Saldo</CardTitle>
        <Wallet className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className={`text-3xl font-bold ${getBalanceColor()} animate-scale-in`}>
              {formatCurrency(balance)}
            </div>
            <Badge variant={badge.variant} className="hover-scale">{badge.text}</Badge>
          </div>
          
          <Button onClick={onTopUp} className="w-full hover-lift" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Opladen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BalanceCard;