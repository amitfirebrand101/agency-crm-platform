import { File, FileText, Music, Trash2, Video } from "lucide-react";
import { addMediaFile, deleteMediaFile } from "@/app/(dashboard)/media/actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatBytes(bytes: bigint): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function MediaIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith("video/")) return <Video className={className} size={28} />;
  if (mimeType.startsWith("audio/")) return <Music className={className} size={28} />;
  if (mimeType.includes("pdf") || mimeType.startsWith("text/")) return <FileText className={className} size={28} />;
  return <File className={className} size={28} />;
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams?: Promise<{ folder?: string }>;
}) {
  const params = await searchParams;
  const folderFilter = params?.folder?.trim() ?? "";

  const user = await requireUser();
  let allFiles: Awaited<ReturnType<typeof prisma.mediaFile.findMany>> = [];
  let databaseUnavailable = false;

  try {
    allFiles = await prisma.mediaFile.findMany({
      where: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId ?? null,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    databaseUnavailable = true;
    console.error("Media page query failed", err);
  }

  const folders = Array.from(new Set(allFiles.map((f) => f.folder).filter(Boolean) as string[])).sort();
  const files = folderFilter
    ? allFiles.filter((f) => f.folder === folderFilter)
    : allFiles;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Media Library</h1>
        <p className="mt-1 text-sm text-muted">
          Store and organize images, videos, and documents.
        </p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* Folder tabs */}
      {folders.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <a
            href="/media"
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              !folderFilter
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-background text-muted"
            }`}
          >
            All
          </a>
          {folders.map((folder) => (
            <a
              key={folder}
              href={`/media?folder=${encodeURIComponent(folder)}`}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                folderFilter === folder
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-background text-muted"
              }`}
            >
              {folder}
            </a>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* File grid */}
        <div className="space-y-4">
          {files.length === 0 && !databaseUnavailable ? (
            <Card>
              <CardBody>
                <div className="py-10 text-center">
                  <File className="mx-auto mb-3 text-muted" size={32} />
                  <p className="font-semibold">No files yet</p>
                  <p className="mt-1 text-sm text-muted">
                    Add files using the &quot;Add by URL&quot; form on the right.
                  </p>
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {files.map((file) => (
                <Card key={file.id} className="overflow-hidden">
                  {/* Preview */}
                  {file.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={file.url}
                      alt={file.altText ?? file.name}
                      className="w-full h-24 object-cover"
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-background">
                      <MediaIcon mimeType={file.mimeType} className="text-muted" />
                    </div>
                  )}
                  <CardBody className="px-3 py-2">
                    <p
                      className="truncate text-sm font-medium"
                      title={file.name}
                    >
                      {file.name}
                    </p>
                    <p className="text-xs text-muted">{formatBytes(file.sizeBytes)}</p>
                    <p className="truncate text-[10px] text-muted/70">{file.mimeType}</p>
                    <form action={deleteMediaFile} className="mt-2">
                      <input type="hidden" name="id" value={file.id} />
                      <SubmitButton
                        className="flex w-full items-center justify-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition"
                        pendingText="…"
                      >
                        <Trash2 size={10} />
                        Delete
                      </SubmitButton>
                    </form>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Add by URL form */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Upload Note</h2>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-muted">
                File upload requires cloud storage (S3/Supabase Storage). Add file URLs manually:
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Add by URL</h2>
            </CardHeader>
            <CardBody>
              <form action={addMediaFile} className="space-y-4">
                <Field label="Name" name="name" placeholder="Company Logo" required />
                <Field
                  label="URL"
                  name="url"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  required
                />
                <Field
                  label="MIME Type"
                  name="mimeType"
                  placeholder="image/jpeg"
                />
                <Field label="Alt Text (optional)" name="altText" placeholder="Company logo" />
                <Field label="Folder (optional)" name="folder" placeholder="logos" />
                <SubmitButton
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                  pendingText="Adding…"
                >
                  Add File
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
