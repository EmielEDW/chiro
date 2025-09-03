import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Archive } from 'lucide-react';
import DrinkGrid from './DrinkGrid';

interface ArchivedDrinksDialogProps {
  children: React.ReactNode;
  balance: number;
  onDrinkLogged: () => void;
}

const ArchivedDrinksDialog = ({ children, balance, onDrinkLogged }: ArchivedDrinksDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Gearchiveerde dranken
          </DialogTitle>
          <DialogDescription>
            Bekijk je gearchiveerde dranken en zet ze terug naar je hoofdweergave.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4">
          <DrinkGrid 
            balance={balance} 
            onDrinkLogged={onDrinkLogged}
            showArchived={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ArchivedDrinksDialog;