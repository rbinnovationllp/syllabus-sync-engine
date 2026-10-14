import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ACQUISITION_DETAIL_OPTIONS,
  ACQUISITION_SOURCE_OPTIONS,
  type AcquisitionFormValue,
} from "@/lib/acquisition";
import { validateCompanyPartner } from "@/lib/admin.functions";

export function AcquisitionSourceFields({
  value,
  onChange,
  required = true,
}: {
  value: AcquisitionFormValue;
  onChange: (next: AcquisitionFormValue) => void;
  required?: boolean;
}) {
  const details = ACQUISITION_DETAIL_OPTIONS[value.acquisition_source] ?? [];
  const validateFn = useServerFn(validateCompanyPartner);
  const [partnerResult, setPartnerResult] = useState<{ valid: boolean; displayName?: string; pending?: boolean } | null>(null);
  const validate = useMutation({
    mutationFn: () => validateFn({ data: { code: value.partner_referral_code?.trim() ?? "" } }),
    onSuccess: (result) => {
      setPartnerResult(result);
      if (result.valid) patch({ partner_name: result.displayName });
    },
    onError: () => setPartnerResult({ valid: false, pending: true }),
  });
  const showPartner = value.acquisition_source === "authorized_partner" || value.acquisition_source === "company_partner";
  const showOther = value.acquisition_source === "other";

  function patch(next: Partial<AcquisitionFormValue>) {
    onChange({ ...value, ...next });
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="space-y-1.5">
        <Label>
          How did you hear about Syllabus Synk?
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        <Select
          value={value.acquisition_source}
          onValueChange={(v) =>
            onChange({
              acquisition_source: v,
              acquisition_detail: "",
              partner_name: "",
              partner_referral_code: "",
              other_source: "",
            })
          }
          required={required}
        >
          <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
          <SelectContent>
            {ACQUISITION_SOURCE_OPTIONS.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {details.length > 0 && (
        <div className="space-y-1.5">
          <Label>Specific channel</Label>
          <Select value={value.acquisition_detail ?? ""} onValueChange={(v) => patch({ acquisition_detail: v })}>
            <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
            <SelectContent>
              {details.map((item) => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showPartner && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Company Partner Name{showPartner && <span className="ml-0.5 text-destructive">*</span>}</Label>
            <Input
              value={value.partner_name ?? ""}
              onChange={(e) => patch({ partner_name: e.target.value })}
              placeholder="Full referring company partner name"
              required={showPartner}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Company Partner ID Code
              {required && <span className="ml-0.5 text-destructive">*</span>}
            </Label>
            <Input
              value={value.partner_referral_code ?? ""}
              onChange={(e) => { setPartnerResult(null); patch({ partner_referral_code: e.target.value }); }}
              onBlur={() => { if (value.partner_referral_code?.trim()) validate.mutate(); }}
              placeholder="Partner ID assigned by Syllabus Synk / RBIL"
              required={required}
            />
            {validate.isPending && <p className="text-xs text-muted-foreground">Checking Partner ID…</p>}
            {partnerResult?.valid && <p className="text-xs text-emerald-600">Verified partner: {partnerResult.displayName}</p>}
            {partnerResult && !partnerResult.valid && (partnerResult.pending ? <p className="text-xs text-amber-600">Partner verification is pending administrator review.</p> : <p className="text-xs text-destructive">Invalid Partner ID. Please verify the code with your referring partner.</p>)}
          </div>
        </div>
      )}

      {showOther && (
        <div className="space-y-1.5">
          <Label>Please specify where you heard about us</Label>
          <Input
            value={value.other_source ?? ""}
            onChange={(e) => patch({ other_source: e.target.value })}
            placeholder="Tell us the source"
            required={required}
          />
        </div>
      )}
    </div>
  );
}
