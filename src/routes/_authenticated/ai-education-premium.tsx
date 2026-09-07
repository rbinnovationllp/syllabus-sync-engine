import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PremiumPricing } from "@/components/PremiumPricing";
import { loadCheckoutScript } from "@/components/RazorpaySubscriptionButton";
import { formatMoney } from "@/lib/ai-education-premium";
import {
  getAiEducationPremium,
  createAiEducationPremiumQuote,
  confirmAiEducationPremiumPayment,
  cancelAiEducationPremium,
  getAiEducationPremiumReceipt,
  generateAiEducationPremiumTeachingPlan,
  listAiEducationPremiumSavedPlans,
  assignAiEducationPremiumTeacher,
  getAiEducationPremiumAdminCatalog,
  saveAiEducationPremiumPackage,
} from "@/lib/ai-education-premium.functions";
import { toast } from "sonner";
export const Route = createFileRoute("/_authenticated/ai-education-premium")({
  component: PremiumPage,
});
const date = (value: string) => new Date(value).toLocaleDateString("en-IN");
const message = (e: unknown) => (e instanceof Error ? e.message : "Please try again later.");
function PremiumPage() {
  const get = useServerFn(getAiEducationPremium),
    checkout = useServerFn(createAiEducationPremiumQuote),
    confirm = useServerFn(confirmAiEducationPremiumPayment),
    cancel = useServerFn(cancelAiEducationPremium),
    receiptFn = useServerFn(getAiEducationPremiumReceipt),
    generate = useServerFn(generateAiEducationPremiumTeachingPlan),
    savedFn = useServerFn(listAiEducationPremiumSavedPlans),
    assign = useServerFn(assignAiEducationPremiumTeacher),
    adminFn = useServerFn(getAiEducationPremiumAdminCatalog),
    saveConfig = useServerFn(saveAiEducationPremiumPackage);
  const query = useQuery({ queryKey: ["ai-education-premium"], queryFn: () => get() });
  const adminQuery = useQuery({ queryKey: ["premium-admin-catalog"], queryFn: () => adminFn() });
  const [busy, setBusy] = useState(false),
    [planBusy, setPlanBusy] = useState(false),
    [receipt, setReceipt] = useState<any>(null),
    [plan, setPlan] = useState<any>(null),
    [teacher, setTeacher] = useState(""),
    [teacherGrade, setTeacherGrade] = useState("1"),
    [config, setConfig] = useState("");
  const [form, setForm] = useState({
    grade: "",
    academicYear: `${new Date().getFullYear()}–${String(new Date().getFullYear() + 1).slice(-2)}`,
    term: "Term 1",
    weekNo: 1,
    topic: "",
    learningObjective: "",
    previousLearning: "",
    durationMinutes: 40,
    language: "English",
    facilities: "Classroom with a board",
  });
  const saved = useQuery({
    queryKey: ["premium-saved", form.grade],
    queryFn: () => savedFn({ data: { grade: form.grade as any } }),
    enabled: !!form.grade,
  });
  async function pay(code: string, interval: "monthly" | "annual") {
    setBusy(true);
    try {
      await loadCheckoutScript();
      const result = await checkout({ data: { packageCode: code, billingInterval: interval } });
      const modal = new window.Razorpay!({
        key: result.keyId,
        order_id: result.orderId,
        amount: result.amount,
        currency: result.currency,
        name: "Syllabus Synk",
        description: `AI Education Premium · ${result.label}`,
        handler: async (response: any) => {
          try {
            await confirm({
              data: {
                subscriptionId: result.subscriptionId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              },
            });
            toast.success("Payment verified. Your school coverage has been saved.");
          } catch (e) {
            toast.info(message(e));
          } finally {
            setBusy(false);
            void query.refetch();
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
            void query.refetch();
          },
        },
        theme: { color: "#0f766e" },
      });
      modal.open();
    } catch (e) {
      toast.error(message(e));
      setBusy(false);
    }
  }
  async function makePlan() {
    setPlanBusy(true);
    try {
      const r = await generate({ data: { ...form, grade: form.grade as any } });
      setPlan(r.plan);
      toast.success(r.cached ? "Opened your saved teaching plan." : "Teaching plan saved.");
      void saved.refetch();
    } catch (e) {
      toast.error(message(e));
    } finally {
      setPlanBusy(false);
    }
  }
  async function showReceipt(id: string) {
    try {
      setReceipt(await receiptFn({ data: { subscriptionId: id } }));
    } catch (e) {
      toast.error(message(e));
    }
  }
  const data = query.data;
  return (
    <AppShell title="AI Education Premium">
      <main className="mx-auto max-w-6xl space-y-8 pb-12">
        {query.isPending ? (
          <p role="status">Loading school plans…</p>
        ) : query.isError ? (
          <div role="alert">
            <p>{message(query.error)}</p>
            <Button onClick={() => query.refetch()}>Try again</Button>
          </div>
        ) : (
          <PremiumPricing
            packages={data?.packages ?? []}
            canManage={!!data?.canManage}
            busy={busy}
            onCheckout={pay}
          />
        )}
        {!!data?.subscriptions.length && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Your coverage and payments</h2>
            <Button variant="outline" onClick={() => query.refetch()}>
              Refresh payment status
            </Button>
            {data.subscriptions.map((s: any) => (
              <div className="rounded-lg border p-4 space-y-2" key={s.id}>
                <h3 className="font-semibold">
                  {s.metadata.package_label ?? "AI Education Premium"} · {s.billing_interval}
                </h3>
                <p className="text-sm">
                  {s.renews_at && Date.parse(s.renews_at) <= Date.now()
                    ? "Expired"
                    : s.starts_at && Date.parse(s.starts_at) > Date.now()
                      ? "Upcoming paid term"
                      : s.status === "pending_payment"
                        ? "Awaiting payment"
                        : s.status === "cancelled"
                          ? "Cancelled — access continues until term end"
                          : s.status}{" "}
                  {s.starts_at && s.renews_at
                    ? ` · ${date(s.starts_at)} to ${date(s.renews_at)}`
                    : ""}
                </p>
                {s.status !== "pending_payment" && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => showReceipt(s.id)}>
                      View payment receipt
                    </Button>
                    {s.status === "active" && Date.parse(s.renews_at) > Date.now() && (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            await cancel({ data: { subscriptionId: s.id } });
                            toast.success(
                              "Cancelled. Paid access remains available until term end.",
                            );
                            void query.refetch();
                          } catch (e) {
                            toast.error(message(e));
                          }
                        }}
                      >
                        Cancel at term end
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
        {receipt && (
          <section className="rounded-xl border p-5 space-y-2" aria-label="Payment receipt">
            <h2 className="text-xl font-semibold">Payment receipt</h2>
            <p>{receipt.subscription.metadata.package_label}</p>
            <p className="break-all text-sm">
              Payment reference: {receipt.payment.provider_payment_id}
            </p>
            <p>Paid on {date(receipt.payment.paid_at)}</p>
            <p>
              Subscription:{" "}
              {formatMoney(receipt.subscription.base_amount_minor / 100, receipt.payment.currency)}
            </p>
            <p>
              GST:{" "}
              {formatMoney(receipt.subscription.tax_amount_minor / 100, receipt.payment.currency)}
            </p>
            <p className="font-bold">
              Total paid:{" "}
              {formatMoney(receipt.payment.amount_minor / 100, receipt.payment.currency)}
            </p>
            <p>
              Coverage: {date(receipt.subscription.starts_at)} to{" "}
              {date(receipt.subscription.renews_at)}
            </p>
            {receipt.payment.invoice_id && <p>Gateway invoice: {receipt.payment.invoice_id}</p>}
            <p className="text-xs text-muted-foreground">
              Payment acknowledgement. Contact support for your GST tax invoice.
            </p>
            <Button variant="outline" onClick={() => window.print()}>
              Print receipt
            </Button>
            <Button variant="ghost" onClick={() => setReceipt(null)}>
              Close receipt
            </Button>
          </section>
        )}
        {!!data?.subscribedGrades.length && (
          <section className="rounded-xl border p-5 space-y-4">
            <h2 className="text-xl font-semibold">Teacher planner</h2>
            <p className="text-sm text-muted-foreground">
              Choose your class and session for age-appropriate teaching guidance, activities,
              practice and understanding checks. Saved plans can be reopened without another
              generation.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                Class
                <select
                  className="block w-full rounded-md border bg-background p-2"
                  value={form.grade}
                  onChange={(e) => {
                    setForm({ ...form, grade: e.target.value });
                    setPlan(null);
                  }}
                >
                  <option value="">Select class</option>
                  {data.subscribedGrades.map((g) => (
                    <option key={g} value={g}>
                      Class {g}
                    </option>
                  ))}
                </select>
              </label>
              {(
                [
                  "academicYear",
                  "term",
                  "topic",
                  "learningObjective",
                  "previousLearning",
                  "language",
                  "facilities",
                ] as const
              ).map((key) => (
                <div key={key}>
                  <Label htmlFor={`premium-${key}`}>
                    {
                      {
                        academicYear: "Academic year",
                        term: "Term",
                        topic: "Topic",
                        learningObjective: "Learning objective (optional)",
                        previousLearning: "Previous learning (optional)",
                        language: "Teaching language",
                        facilities: "Available facilities",
                      }[key]
                    }
                  </Label>
                  <Input
                    id={`premium-${key}`}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <Label htmlFor="premium-week">Week/session</Label>
                <Input
                  id="premium-week"
                  type="number"
                  min={1}
                  max={60}
                  value={form.weekNo}
                  onChange={(e) => setForm({ ...form, weekNo: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="premium-duration">Lesson duration (minutes)</Label>
                <Input
                  id="premium-duration"
                  type="number"
                  min={20}
                  max={180}
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                />
              </div>
            </div>
            <Button
              disabled={!form.grade || form.topic.trim().length < 2 || planBusy}
              onClick={makePlan}
            >
              {planBusy ? "Preparing guidance…" : "Prepare teaching plan"}
            </Button>
            {!!saved.data?.length && (
              <div className="space-y-2">
                <h3 className="font-semibold">Saved plans for this class</h3>
                {saved.data.map((p: any) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    className="mr-2 h-auto whitespace-normal text-left"
                    onClick={() => setPlan(p.output)}
                  >
                    {p.topic} · {p.academic_year}
                  </Button>
                ))}
              </div>
            )}
          </section>
        )}
        {plan && (
          <section className="rounded-xl border p-5 space-y-4">
            <h2 className="text-2xl font-semibold">{plan.title}</h2>
            <p>{plan.what_to_teach}</p>
            <p>
              <strong>When:</strong> {plan.when_to_teach}
            </p>
            {plan.full_lesson ? (
              Object.entries(plan.full_lesson).map(([key, value]) => (
                <details key={key} open={key === "A"} className="rounded border p-3">
                  <summary className="cursor-pointer font-semibold">
                    {(
                      {
                        A: "Module information",
                        B: "Learning outcomes",
                        C: "Vocabulary",
                        D: "Topic explanation",
                        E: "Teaching script",
                        F: "Lesson timeline",
                        G: "Examples and demonstrations",
                        H: "Tool guidance",
                        I: "Classroom activity",
                        J: "Practical task",
                        K: "Student questions",
                        L: "Misconceptions",
                        M: "Understanding check",
                        N: "Assessment, answer key and rubric",
                        O: "Extension or project",
                        P: "Accessibility and differentiation",
                        Q: "Teacher preparation",
                        R: "Lesson conclusion",
                      } as any
                    )[key] ?? key}
                  </summary>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm">{String(value)}</p>
                </details>
              ))
            ) : (
              <>
                <p>{plan.teacher_guidance}</p>
                <p>{plan.teaching_script}</p>
                <p>{plan.student_practice}</p>
                <p>{plan.responsible_ai_note}</p>
                <p>{plan.next_step}</p>
              </>
            )}
          </section>
        )}
        {data?.canManage && (
          <details className="rounded-xl border p-5">
            <summary className="cursor-pointer font-semibold">Assign a teacher to a class</summary>
            <p className="mt-3 text-sm">Choose a member of your school and the class they teach.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                aria-label="Teacher"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                className="max-w-full rounded border p-2"
              >
                <option value="">Choose teacher</option>
                {data.members.map((m: any) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profiles?.display_name ?? m.profiles?.email ?? "School member"}
                  </option>
                ))}
              </select>
              <select
                aria-label="Teacher class"
                value={teacherGrade}
                onChange={(e) => setTeacherGrade(e.target.value)}
                className="rounded border p-2"
              >
                {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((g) => (
                  <option key={g} value={g}>
                    Class {g}
                  </option>
                ))}
              </select>
              {[true, false].map((active) => (
                <Button
                  key={String(active)}
                  variant={active ? "default" : "outline"}
                  onClick={async () => {
                    try {
                      await assign({
                        data: { userId: teacher, grade: teacherGrade as any, active },
                      });
                      toast.success(active ? "Teacher assigned." : "Assignment removed.");
                    } catch (e) {
                      toast.error(message(e));
                    }
                  }}
                >
                  {active ? "Assign" : "Remove assignment"}
                </Button>
              ))}
            </div>
          </details>
        )}
        {adminQuery.data && (
          <details className="rounded-xl border p-5 space-y-3">
            <summary className="cursor-pointer font-semibold">
              Super administrator: pricing configuration
            </summary>
            <p className="text-sm">
              Changes apply to new checkouts. Existing payments keep their original prices.
              Promotional and discount fields reserve future rules; they are not applied to current
              purchases.
            </p>
            <select
              aria-label="Package to configure"
              className="w-full rounded border p-2"
              onChange={(e) => {
                const row = adminQuery.data.find((p: any) => p.code === e.target.value);
                if (row) {
                  const { created_at, updated_at, ...editable } = row;
                  setConfig(JSON.stringify(editable, null, 2));
                }
              }}
            >
              <option value="">Choose a package</option>
              {adminQuery.data.map((p: any) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
            <Textarea
              aria-label="Pricing configuration JSON"
              rows={20}
              className="font-mono text-xs"
              value={config}
              onChange={(e) => setConfig(e.target.value)}
            />
            <Button
              onClick={async () => {
                try {
                  await saveConfig({ data: JSON.parse(config) });
                  toast.success("Pricing saved.");
                  void adminQuery.refetch();
                  void query.refetch();
                } catch {
                  toast.error("Check all pricing fields and dates, then try again.");
                }
              }}
            >
              Save pricing configuration
            </Button>
          </details>
        )}
      </main>
    </AppShell>
  );
}
