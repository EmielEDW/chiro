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
    <Card className="max-w-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-4 w-4" />
          Website QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!qrCodeUrl ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
              <QrCode className="h-6 w-6 text-muted-foreground" />
            </div>
            <Button 
              onClick={generateQRCode} 
              disabled={isGenerating}
              size="sm"
            >
              {isGenerating ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
              ) : (
                <QrCode className="h-3 w-3 mr-2" />
              )}
              Genereer QR
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-white p-2 rounded inline-block">
              <img src={qrCodeUrl} alt="Website QR Code" className="w-24 h-24" />
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={copyUrl}
                size="sm"
                className="flex-1"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
              <Button 
                onClick={downloadQRCode}
                size="sm"
                className="flex-1"
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};