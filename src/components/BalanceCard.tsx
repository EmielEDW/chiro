import { Button } from '@/components/ui/button';
import { Plus, Wallet } from 'lucide-react';

interface BalanceCardProps {
  balance: number;
  onTopUp: () => void;
}

const BalanceCard = ({ balance, onTopUp }: BalanceCardProps) => {
  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const isLowBalance = balance <= 500;

  return (
    <div className="glass-card p-6 text-center relative overflow-hidden">
      {/* Subtle gradient accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Wallet className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Jouw Saldo</p>
        </div>
        
        <div className={`text-5xl font-bold tracking-tight mb-4 ${isLowBalance ? 'text-primary' : 'text-foreground'}`}>
          {formatCurrency(balance)}
        </div>
        
        <Button onClick={onTopUp} className="px-6 shadow-lg" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Opladen
        </Button>
      </div>
    </div>
  );
};

export default BalanceCard;