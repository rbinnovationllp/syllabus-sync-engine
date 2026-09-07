import { gstInclusiveBreakdown } from "./plans";
export async function recordBillingReceipt(
  db: any,
  data: {
    provider: string;
    environment: string;
    paymentId: string;
    userId: string;
    priceId?: string;
    currency: string;
    total: number;
  },
) {
  const split = gstInclusiveBreakdown(data.total, data.currency);
  const result = await db
    .from("billing_receipts")
    .upsert(
      {
        provider: data.provider,
        environment: data.environment,
        provider_payment_id: data.paymentId,
        user_id: data.userId,
        price_id: data.priceId ?? null,
        currency: data.currency.toLowerCase(),
        taxable_amount_minor: split.taxableMinor,
        gst_amount_minor: split.gstMinor,
        total_amount_minor: split.totalMinor,
        gst_inclusive: true,
      },
      { onConflict: "provider,environment,provider_payment_id", ignoreDuplicates: true },
    );
  if (result.error) throw new Error("Payment receipt could not be recorded");
}
