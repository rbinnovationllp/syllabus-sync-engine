import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Loader2, RotateCcw } from "lucide-react";
import {
  listCurriculumVersions,
  restoreCurriculumVersion,
} from "@/lib/curriculum-versions.functions";

type Props = {
  year_id: string;
  entity_type: "annual_calendar" | "subject_curriculum";
  grade?: string | null;
  subject?: string | null;
  canRestore: boolean;
  triggerLabel?: string;
};

export function VersionHistoryDialog({
  year_id,
  entity_type,
  grade = null,
  subject = null,
  canRestore,
  triggerLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const listFn = useServerFn(listCurriculumVersions);
  const restoreFn = useServerFn(restoreCurriculumVersion);

  const key = ["curriculum-versions", year_id, entity_type, grade, subject];
  const versions = useQuery({
    queryKey: key,
    queryFn: () => listFn({ data: { year_id, entity_type, grade, subject } }),
    enabled: open,
  });

  const restore = useMutation({
    mutationFn: (id: string) => restoreFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Version restored");
      qc.invalidateQueries({ queryKey: ["year-artifacts"] });
      qc.invalidateQueries({ queryKey: key });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <History className="h-4 w-4 mr-1" /> {triggerLabel ?? "History"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Every generation, recalibration, and restore is preserved permanently.
          </DialogDescription>
        </DialogHeader>
        {versions.isLoading ? (
          <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !versions.data || versions.data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No saved versions yet.</p>
        ) : (
          <ul className="space-y-2 max-h-[60vh] overflow-auto">
            {versions.data.map((v: any) => (
              <li key={v.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                <div className="text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">v{v.version_no}</Badge>
                    <Badge variant="secondary" className="capitalize">{v.source}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleString()}
                    </span>
                  </div>
                  {v.diff_summary && (
                    <p className="mt-1 text-muted-foreground">{v.diff_summary}</p>
                  )}
                </div>
                {canRestore && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={restore.isPending}
                    onClick={() => {
                      if (confirm(`Restore v${v.version_no}? Current version will be archived as a new version.`)) {
                        restore.mutate(v.id);
                      }
                    }}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
