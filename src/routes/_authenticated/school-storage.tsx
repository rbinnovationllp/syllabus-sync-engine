import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  completeSchoolFileUpload,
  createSchoolFileDownload,
  createSchoolFileUpload,
  deleteSchoolFile,
  getSchoolStorageDashboard,
} from "@/lib/school-storage.functions";
import { Download, HardDrive, Loader2, Trash2, UploadCloud } from "lucide-react";

export const Route = createFileRoute("/_authenticated/school-storage")({
  component: SchoolStoragePage,
});

function formatBytes(bytes: number) {
  if (!bytes) return "0 GB";
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function SchoolStoragePage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const dashboardFn = useServerFn(getSchoolStorageDashboard);
  const createUploadFn = useServerFn(createSchoolFileUpload);
  const completeUploadFn = useServerFn(completeSchoolFileUpload);
  const downloadFn = useServerFn(createSchoolFileDownload);
  const deleteFn = useServerFn(deleteSchoolFile);

  const storage = useQuery({
    queryKey: ["school-storage-dashboard"],
    queryFn: () => dashboardFn(),
  });

  const percentUsed = useMemo(() => {
    const quota = storage.data?.quotaBytes ?? 1;
    const used = storage.data?.usedBytes ?? 0;
    return Math.min(100, Math.round((used / quota) * 100));
  }, [storage.data]);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file first.");
      setMessage(null);

      const prepared = await createUploadFn({
        data: {
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          category: "document",
        },
      });

      const uploadResult = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": prepared.contentType },
        body: file,
      });

      if (!uploadResult.ok) {
        throw new Error("AWS upload failed. Check the S3 bucket CORS settings.");
      }

      await completeUploadFn({ data: { id: prepared.id } });
    },
    onSuccess: async () => {
      setFile(null);
      setMessage("File uploaded successfully.");
      await queryClient.invalidateQueries({ queryKey: ["school-storage-dashboard"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school-storage-dashboard"] }),
  });

  async function downloadFile(id: string) {
    const result = await downloadFn({ data: { id } });
    window.location.href = result.url;
  }

  return (
    <AppShell title="School Storage">
      <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge className="mb-3 bg-blue-100 text-blue-800 hover:bg-blue-100">AWS S3 protected storage</Badge>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">School Storage</h1>
              <p className="mt-2 max-w-3xl text-slate-600">
                Store school documents, curriculum files, circulars, exports, and academic records within the storage quota assigned to your subscription.
              </p>
            </div>
          </div>

          {message ? (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
              <AlertTitle>Done</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          {upload.error ? (
            <Alert variant="destructive">
              <AlertTitle>Upload failed</AlertTitle>
              <AlertDescription>{upload.error.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UploadCloud className="h-5 w-5 text-blue-600" />
                  Upload school file
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <Input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                <div className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-slate-700">Current quota</span>
                    <span className="text-sm font-semibold text-slate-950">
                      {formatBytes(storage.data?.usedBytes ?? 0)} / {storage.data?.quotaGb ?? 0} GB
                    </span>
                  </div>
                  <Progress value={percentUsed} className="mt-3" />
                  <p className="mt-2 text-xs text-slate-500">
                    Plan: {storage.data?.planCode ?? "loading"} Â· Files are stored in AWS, while only metadata is stored in Supabase.
                  </p>
                </div>
                <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()} className="w-full sm:w-auto">
                  {upload.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  Upload file
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-blue-600" />
                  Stored files
                </CardTitle>
              </CardHeader>
              <CardContent>
                {storage.isLoading ? (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading storage...
                  </div>
                ) : storage.data?.files?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
                          <th className="py-3 pr-4">File</th>
                          <th className="py-3 pr-4">Size</th>
                          <th className="py-3 pr-4">Status</th>
                          <th className="py-3 pr-4">Uploaded</th>
                          <th className="py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storage.data.files.map((item: any) => (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="py-3 pr-4 font-medium text-slate-900">{item.file_name}</td>
                            <td className="py-3 pr-4 text-slate-600">{formatBytes(Number(item.size_bytes))}</td>
                            <td className="py-3 pr-4">
                              <Badge variant={item.status === "active" ? "default" : "secondary"}>{item.status}</Badge>
                            </td>
                            <td className="py-3 pr-4 text-slate-600">{new Date(item.created_at).toLocaleDateString()}</td>
                            <td className="py-3">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" disabled={item.status !== "active"} onClick={() => downloadFile(item.id)}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </Button>
                                <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => remove.mutate(item.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-slate-600">
                    No files uploaded yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
