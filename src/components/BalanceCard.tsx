import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface BalanceCardProps {
  balance: number;
  onTopUp: () => void;
}

const BalanceCard = ({ balance, onTopUp }: BalanceCardProps) => {
  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const getBalanceColor = () => {
    if (balance > 500) return 'text-foreground';
    return 'text-yellow-600';
  };

  return (
    <div className="glass-card p-6 text-center">
      <p className="text-sm text-muted-foreground mb-1">Jouw Saldo</p>
      <div className={`text-5xl font-bold tracking-tight ${getBalanceColor()} mb-4`}>
        {formatCurrency(balance)}
      </div>
      <Button onClick={onTopUp} className="rounded-full px-6" size="sm">
        <Plus className="mr-2 h-4 w-4" />
        Opladen
      </Button>
    </div>
  );
};

export default BalanceCard;