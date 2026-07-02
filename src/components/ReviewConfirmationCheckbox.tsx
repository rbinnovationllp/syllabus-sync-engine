import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { REVIEW_CONFIRMATION_TEXT } from "@/lib/governance.functions";

export function ReviewConfirmationCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start gap-3">
        <Checkbox
          id="ai-review-confirmation"
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          className="mt-1"
        />
        <Label htmlFor="ai-review-confirmation" className="text-sm leading-5 text-slate-700">
          {REVIEW_CONFIRMATION_TEXT}
        </Label>
      </div>
    </div>
  );
}
