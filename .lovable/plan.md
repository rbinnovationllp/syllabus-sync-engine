# Plan — Anti-abuse + New Pricing + Seats

## 1. Pricing rewrite (`src/lib/plans.ts`)

Update all 5 tiers + add-ons. Keep USD and INR side-by-side.

| Plan | INR/mo | USD/mo | Users | AI credits | Storage |
|---|---|---|---|---|---|
| Retail Single | ₹499 | $9 | 1 | 500 | 1 GB |
| Primary | ₹1,999 | $29 | 6 | 2,000 | 10 GB |
| Middle | ₹2,999 | $39 | 10 | 3,000 | 20 GB |
| High School | ₹4,999 | $59 | 18 | 5,000 | 50 GB |
| Enterprise | ₹14,999 | $179 | 60 | 20,000 | 200 GB |

Annual prices = 10× monthly (2 months free per existing `annualRebateEligible` rule).

**Add-ons**
- `extra_user` — ₹199/mo (~$2.50/mo) — recurring, seat-based quantity (1–500)
- `extra_campus` — update from ₹5,000 → ₹4,999/mo (~$59/mo)
- AI credit top-ups unchanged

**Support tiers** added to each plan: Email / Email 48h / Priority Email / Phone+Email / Dedicated AM.
**Enterprise capped at 1 campus** (was 2).

## 2. Stripe products

Create new `extra_user` product with monthly INR + USD prices (qty 1–500).
Update existing `extra_campus_monthly_inr` price (₹5,000 → ₹4,999) and other changed prices. Note: Stripe prices are immutable — we create new `price_id`s (e.g. `bundle_high_monthly_inr_v2`) and switch the catalog over. Old subscribers keep their original price until renewal.

## 3. AI + export gating

Wrap every server function that costs credits or returns an export blob with a subscription check:

```ts
const { data: active } = await context.supabase
  .rpc('has_active_subscription', { user_uuid: context.userId, check_env: env });
if (!active) return { error: 'PAID_PLAN_REQUIRED' };
```

Functions to gate (in `src/lib/onboarding.functions.ts` and anywhere we add export fns):
- `generateAnnualCalendar`, `generateSubjectCurriculum`, `recalculateSchedule`, `generateLessonPlan`, `generateTeacherTraining`
- All export endpoints (PDF / DOCX / XLSX)

Client-side: in onboarding/results pages, if `useSubscription().isActive === false`, show an "Upgrade to generate" CTA over the action buttons (still let them fill the wizard and preview a sample).

## 4. DEMO watermark on exports

For PDF/DOCX exports generated when user is on a free/expired plan (or for a public sample), stamp every page diagonally:
> **DEMO — Not Licensed for Production Use**

Implementation: in the PDF generator, overlay a 45°-rotated grey 60pt text across each page when `subscription.isActive` is false. (Once gating is in place this only fires for the public sample preview, but it's a belt-and-braces guard.)

## 5. Seats management

**DB migration:** add `extra_seats` integer column to `subscriptions` (incremented by webhook when `extra_user` quantity changes).

**Server fns** (`src/lib/seats.functions.ts`):
- `listSeatMembers()` — current org members + pending invites
- `inviteSeatMember({ email, role })` — checks `(planSeats + extra_seats) > currentMembers`; if over, returns `{ needsCheckout: true, addonPriceId }`
- `removeSeatMember({ userId })`
- `updateSeatCount({ delta })` — opens Stripe checkout to adjust `extra_user` quantity

**UI:** `src/routes/_authenticated/seats.tsx` — table of members with invite/remove, seat counter (e.g. "8 / 10 used"), "Add seat (₹199/mo)" button that opens checkout.

**Roles:** Principal/Admin, Academic Coordinator, Teacher, Read-Only — stored in `org_members.role` (already exists).

## 6. Pricing page

Update `src/routes/_authenticated/pricing.tsx` to render the new restrictions, storage row, support row, add-ons section (Extra User, Extra Campus, AI top-ups, Paid Services).

## Out of scope (not doing this turn)
- Invite codes (you chose preview-link instead)
- Actual email invite delivery — we'll generate an invite link the admin can share manually
- Migrating existing subscribers to new prices (their old prices remain valid in Stripe)

## File changes
- Edit: `src/lib/plans.ts`, `src/lib/onboarding.functions.ts`, `src/routes/_authenticated/onboarding.tsx`, `src/routes/_authenticated/results.$yearId.tsx`, `src/routes/_authenticated/pricing.tsx`, `src/components/AppShell.tsx` (nav link)
- New: `src/lib/seats.functions.ts`, `src/routes/_authenticated/seats.tsx`, `src/lib/watermark.ts`
- DB migration: `extra_seats` column on `subscriptions`
- Stripe: new `extra_user` product + revised prices via `payments--batch_create_product`

Approve and I'll execute in this order: migration → plans.ts → Stripe products → gating → seats UI → watermark → pricing page.
