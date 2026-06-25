import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Smartphone, Mail, MessageCircle } from "lucide-react";
import { UPI_CONFIG, buildUpiUrl } from "@/lib/upi";
import { toast } from "sonner";

interface UpiPaymentPanelProps {
  /** Amount in the smallest currency unit (cents / paise). */
  amountInCents: number;
  currency: string;
  planName?: string;
}

export function UpiPaymentPanel({ amountInCents, currency, planName }: UpiPaymentPanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const upiUrl = buildUpiUrl(amountInCents, currency, planName);

  const isInr = currency.toLowerCase() === "inr";
  const amountDisplay = isInr
    ? `₹${(amountInCents / 100).toFixed(2)}`
    : `$${(amountInCents / 100).toFixed(2)}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(upiUrl, { width: 240, margin: 2, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [upiUrl]);

  function copyUpiId() {
    navigator.clipboard.writeText(UPI_CONFIG.upiId).then(() => {
      setCopied(true);
      toast.success("UPI ID copied");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function openUpiApp() {
    window.location.href = upiUrl;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Pay via UPI / Google Pay / PhonePe
        </CardTitle>
        <CardDescription>
          Scan the QR code or copy the UPI ID to pay <strong>{amountDisplay}</strong> manually.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {qrDataUrl ? (
          <div className="flex justify-center">
            <img
              src={qrDataUrl}
              alt={`UPI QR code for ${amountDisplay}`}
              className="rounded-lg border"
            />
          </div>
        ) : (
          <div className="flex justify-center h-60 items-center text-sm text-muted-foreground">
            Generating QR code…
          </div>
        )}

        <div className="flex items-center gap-2 rounded-md border p-2 bg-muted/30">
          <code className="flex-1 text-sm">{UPI_CONFIG.upiId}</code>
          <Button size="icon" variant="ghost" onClick={copyUpiId} aria-label="Copy UPI ID">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <Button className="w-full" onClick={openUpiApp}>
          Open UPI app to pay
        </Button>

        <div className="text-xs text-muted-foreground space-y-2 border-t pt-3">
          <p className="font-medium text-foreground">How to complete your payment</p>
          <ol className="space-y-1 list-decimal list-inside">
            <li>Scan the QR code or copy the UPI ID above.</li>
            <li>
              Enter the exact amount: <strong>{amountDisplay}</strong>.
            </li>
            <li>
              After payment, send the screenshot or UTR number to:
              <div className="mt-1 space-y-1 pl-1">
                <p className="flex items-center gap-1.5">
                  <Mail className="h-3 w-3" />
                  {UPI_CONFIG.receiptEmail}
                </p>
                <p className="flex items-center gap-1.5">
                  <MessageCircle className="h-3 w-3" />
                  {UPI_CONFIG.receiptPhone}
                </p>
              </div>
            </li>
          </ol>
          <p>Your subscription will be activated manually after verification.</p>
        </div>
      </CardContent>
    </Card>
  );
}
