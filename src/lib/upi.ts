// Configurable UPI (Google Pay / PhonePe / Paytm) manual payment settings.
// Edit the values below to use your own UPI ID and contact details.

export const UPI_CONFIG = {
  /** Your UPI ID, e.g. "yourname@okicici" or "yourname@ybl". */
  upiId: "your-upi-id@bank",
  /** Name shown in the payer's UPI app. */
  payeeName: "CurriculumOS",
  /** Whether to show the UPI payment option on the India (INR) pricing page. */
  enabled: true,
  /** Email where users should send payment screenshots/receipts. */
  receiptEmail: "billing@curriculumos.example",
  /** WhatsApp/phone where users should send payment screenshots/receipts. */
  receiptPhone: "+91-00000-00000",
  /** Default note shown in the UPI app transaction. */
  transactionNote: "CurriculumOS subscription",
};

export function buildUpiUrl(
  amountInCents: number,
  currency: string,
  planName?: string,
): string {
  const params = new URLSearchParams();
  params.set("pa", UPI_CONFIG.upiId);
  params.set("pn", UPI_CONFIG.payeeName);
  if (currency.toLowerCase() === "inr") {
    params.set("am", (amountInCents / 100).toFixed(2));
    params.set("cu", "INR");
  }
  const note = planName
    ? `${UPI_CONFIG.transactionNote} - ${planName}`
    : UPI_CONFIG.transactionNote;
  params.set("tn", note);
  return `upi://pay?${params.toString()}`;
}
