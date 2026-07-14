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
  archiveAcademicSessionStorage,
  completeSchoolFileUpload,
  createSchoolFileDownload,
  createSchoolFileUpload,
  deleteSchoolFile,
  getSchoolStorageDashboard,
} from "@/lib/school-storage.functions";
import { Archive, Bell, Download, FileBarChart, HardDrive, Loader2, Trash2, UploadCloud } from "lucide-react";

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
  const archiveFn = useServerFn(archiveAcademicSessionStorage);

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

  const archiveSession = useMutation({
    mutationFn: (academicYearId: string) => archiveFn({ data: { academicYearId, storageClass: "archive" } }),
    onSuccess: async (result) => {
      const archivedFiles = (result as { archivedFiles?: number }).archivedFiles ?? 0;
      setMessage(`Academic session archived. ${archivedFiles} file(s) marked for lower-cost archive storage.`);
      await queryClient.invalidateQueries({ queryKey: ["school-storage-dashboard"] });
    },
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

          {storage.data?.alertLevel ? (
            <Alert variant={storage.data.alertLevel >= 100 ? "destructive" : "default"} className="border-amber-200 bg-amber-50 text-amber-950">
              <Bell className="h-4 w-4" />
              <AlertTitle>Storage usage alert: {storage.data.alertLevel}% threshold reached</AlertTitle>
              <AlertDescription>
                {storage.data.alertLevel >= 100
                  ? "Further uploads are blocked until storage is freed, archived, or additional storage is purchased."
                  : "Review large files, archive inactive sessions, or buy additional storage before the upload limit is reached."}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <StorageMetric label="Total Allocated Storage" value={`${storage.data?.quotaGb ?? 0} GB`} />
            <StorageMetric label="Used Storage" value={formatBytes(storage.data?.usedBytes ?? 0)} />
            <StorageMetric label="Available Storage" value={formatBytes(storage.data?.availableBytes ?? 0)} />
          </div>

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
                    Plan: {storage.data?.planCode ?? "loading"} · Base {storage.data?.baseQuotaGb ?? 0} GB + extra {storage.data?.extraStorageGb ?? 0} GB.
                  </p>
                </div>
                <Button disabled={!file || upload.isPending || storage.data?.uploadBlocked} onClick={() => upload.mutate()} className="w-full sm:w-auto">
                  {upload.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  Upload file
                </Button>
                {storage.data?.uploadBlocked ? (
                  <p className="text-xs font-medium text-red-700">
                    Uploads are paused because the allocated storage limit has been reached.
                  </p>
                ) : null}
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
                              <div className="flex flex-wrap gap-1">
                                <Badge variant={item.status === "active" ? "default" : "secondary"}>{item.status}</Badge>
                                {item.archived_at ? <Badge variant="outline">archived</Badge> : null}
                              </div>
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

          <div className="grid gap-6 xl:grid-cols-2">
            <BreakdownCard title="Usage by Category" rows={storage.data?.categoryBreakdown ?? []} />
            <BreakdownCard title="File Type Breakdown" rows={storage.data?.fileTypeBreakdown ?? []} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileBarChart className="h-5 w-5 text-blue-600" />
                  Largest Files
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StorageRows
                  rows={(storage.data?.largestFiles ?? []).map((file: any) => ({
                    label: file.file_name,
                    detail: file.archived_at ? "Archived" : file.category || "File",
                    bytes: Number(file.size_bytes ?? 0),
                  }))}
                  empty="No large files found."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-blue-600" />
                  User-wise Storage Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StorageRows
                  rows={(storage.data?.userUsage ?? []).map((row: any) => ({
                    label: row.userName,
                    detail: `${row.count} file${row.count === 1 ? "" : "s"}`,
                    bytes: Number(row.bytes ?? 0),
                  }))}
                  empty="No user usage found."
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-blue-600" />
                  Academic Session Archive
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-600">
                  Previous sessions can be archived after they end. Archived data remains available, while metadata marks it for lower-cost archive storage.
                </p>
                {(storage.data?.sessions ?? []).length ? (
                  <div className="space-y-2">
                    {storage.data.sessions.map((session: any) => {
                      const ended = session.end_date ? new Date(session.end_date) < new Date() : false;
                      const archived = session.status === "archived";
                      return (
                        <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3">
                          <div>
                            <div className="font-medium text-slate-900">{session.label}</div>
                            <div className="text-xs text-slate-500">{session.start_date} to {session.end_date}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={archived ? "secondary" : ended ? "outline" : "default"}>{archived ? "Archived" : ended ? "Ready to archive" : "Active"}</Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!ended || archived || archiveSession.isPending}
                              onClick={() => archiveSession.mutate(session.id)}
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Archive
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No academic sessions found.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fair Usage & Add-on Storage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-700">
                <p>{storage.data?.fairUsagePolicy}</p>
                <div>
                  <div className="font-medium text-slate-950">Available add-on packs</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(storage.data?.storagePacksGb ?? [25, 50, 100, 250, 500]).map((pack: number) => (
                      <Badge key={pack} variant="outline">{pack >= 1024 ? `${pack / 1024} TB` : `${pack} GB`}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-slate-950">Enterprise dedicated storage</div>
                  <p className="mt-1">{(storage.data?.enterpriseStoragePlans ?? []).join(", ")}.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function StorageMetric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: Array<{ label: string; bytes: number; count: number }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <StorageRows
          rows={rows.map((row) => ({
            label: row.label,
            detail: `${row.count} file${row.count === 1 ? "" : "s"}`,
            bytes: Number(row.bytes ?? 0),
          }))}
          empty="No storage usage found."
        />
      </CardContent>
    </Card>
  );
}

function StorageRows({ rows, empty }: { rows: Array<{ label: string; detail: string; bytes: number }>; empty: string }) {
  if (!rows.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={`${row.label}-${row.detail}`} className="flex items-center justify-between gap-4 rounded-md border border-slate-200 bg-white p-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-900">{row.label}</div>
            <div className="text-xs text-slate-500">{row.detail}</div>
          </div>
          <div className="shrink-0 font-semibold text-slate-950">{formatBytes(row.bytes)}</div>
        </div>
      ))}
    </div>
  );
}
