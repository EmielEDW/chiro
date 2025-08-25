import { useState } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, QrCode } from 'lucide-react';
import { toast } from 'sonner';

interface QRCodeGeneratorProps {
  item: {
    id: string;
    name: string;
    price_cents: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const QRCodeGenerator = ({ item, open, onOpenChange }: QRCodeGeneratorProps) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const generateQRCode = async () => {
    setIsGenerating(true);
    try {
      // Create QR data with item information
      const qrData = JSON.stringify({
        type: 'item',
        itemId: item.id,
        name: item.name,
        price: item.price_cents
      });

      const url = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      setQrCodeUrl(url);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Failed to generate QR code');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement('a');
    link.download = `qr-${item.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = qrCodeUrl;
    link.click();
    
    toast.success('QR code downloaded!');
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code for {item.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 text-center space-y-2">
              <h3 className="font-semibold">{item.name}</h3>
              <p className="text-lg font-bold text-primary">
                {formatCurrency(item.price_cents)}
              </p>
            </CardContent>
          </Card>

          {!qrCodeUrl ? (
            <div className="text-center space-y-4">
              <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center mx-auto">
                <QrCode className="h-16 w-16 text-muted-foreground" />
              </div>
              <Button 
                onClick={generateQRCode} 
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <QrCode className="h-4 w-4 mr-2" />
                )}
                Generate QR Code
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="bg-white p-4 rounded-lg inline-block">
                <img src={qrCodeUrl} alt={`QR Code for ${item.name}`} className="mx-auto" />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={generateQRCode}
                  className="flex-1"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <Button 
                  onClick={downloadQRCode}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Print this QR code and place it on/near the product. 
                Users can scan it to instantly purchase the item.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};