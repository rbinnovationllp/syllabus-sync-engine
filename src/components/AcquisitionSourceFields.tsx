import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ACQUISITION_DETAIL_OPTIONS,
  ACQUISITION_SOURCE_OPTIONS,
  type AcquisitionFormValue,
} from "@/lib/acquisition";

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
  const showPartner = value.acquisition_source === "authorized_partner";
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
            <Label>Partner name</Label>
            <Input
              value={value.partner_name ?? ""}
              onChange={(e) => patch({ partner_name: e.target.value })}
              placeholder="Registered partner name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Partner ID / Referral Code
              {required && <span className="ml-0.5 text-destructive">*</span>}
            </Label>
            <Input
              value={value.partner_referral_code ?? ""}
              onChange={(e) => patch({ partner_referral_code: e.target.value })}
              placeholder="Preferred for commission tracking"
              required={required}
            />
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
