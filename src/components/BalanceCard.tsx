import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Jouw Saldo</CardTitle>
        <Wallet className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className={`text-3xl font-bold ${getBalanceColor()}`}>
            {formatCurrency(balance)}
          </div>
          
          <Button onClick={onTopUp} className="w-full" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Opladen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BalanceCard;