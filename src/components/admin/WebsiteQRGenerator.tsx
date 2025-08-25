import { useState } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, QrCode, Copy } from 'lucide-react';
import { toast } from 'sonner';

export const WebsiteQRGenerator = () => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const websiteUrl = window.location.origin;

  const generateQRCode = async () => {
    setIsGenerating(true);
    try {
      const url = await QRCode.toDataURL(websiteUrl, {
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
    link.download = 'chiro-drinks-website-qr.png';
    link.href = qrCodeUrl;
    link.click();
    
    toast.success('QR code downloaded!');
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(websiteUrl);
    toast.success('Website URL copied to clipboard!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Website QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p>Genereer een QR code die gebruikers direct naar de website brengt.</p>
          <p className="font-mono bg-muted p-2 rounded mt-2 break-all">{websiteUrl}</p>
        </div>

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
              <img src={qrCodeUrl} alt="Website QR Code" className="mx-auto" />
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={copyUrl}
                className="flex-1"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy URL
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
              Print deze QR code en plaats hem waar mensen hem kunnen scannen om direct naar de website te gaan.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};