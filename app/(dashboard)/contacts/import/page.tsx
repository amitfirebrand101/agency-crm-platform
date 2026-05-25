"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { ArrowLeft, CheckCircle2, Loader2, Upload, X } from "lucide-react";

type ParsedRow = Record<string, string>;

const CRM_FIELDS = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "companyName", label: "Company" },
  { key: "status", label: "Status (LEAD/CUSTOMER/INACTIVE)" },
  { key: "source", label: "Source" },
  { key: "addressLine1", label: "Address" },
  { key: "city", label: "City" },
  { key: "region", label: "State/Region" },
  { key: "country", label: "Country" },
  { key: "postalCode", label: "Postal Code" },
] as const;

type CrmField = (typeof CRM_FIELDS)[number]["key"];

export default function ImportPage() {
  const [step, setStep] = useState<"upload" | "map" | "importing" | "done">("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<CrmField, string>>({} as Record<CrmField, string>);
  const [tagOnImport, setTagOnImport] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (!res.data.length) { setError("The CSV file is empty."); return; }
        const headers = Object.keys(res.data[0] ?? {});
        setCsvHeaders(headers);
        setRows(res.data);

        // Auto-map common column names
        const autoMap: Record<string, string> = {};
        const normalise = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
        for (const field of CRM_FIELDS) {
          for (const h of headers) {
            if (normalise(h) === normalise(field.key) || normalise(h) === normalise(field.label)) {
              autoMap[field.key] = h;
              break;
            }
          }
        }
        setMapping(autoMap as Record<CrmField, string>);
        setStep("map");
      },
      error: (err: Error) => setError(err.message),
    });
  }

  async function handleImport() {
    if (!mapping.firstName) { setError("First Name column is required."); return; }
    setStep("importing");
    setError(null);

    const payload = rows.map((row) => {
      const contact: Record<string, string> = {};
      for (const field of CRM_FIELDS) {
        const col = mapping[field.key];
        if (col && row[col] != null) contact[field.key] = String(row[col]).trim();
      }
      return contact;
    });

    try {
      const r = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: payload, tagOnImport }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? "Import failed."); setStep("map"); return; }
      setResult(data);
      setStep("done");
    } catch (err) {
      setError(String(err));
      setStep("map");
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/contacts" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={15} /> Back to contacts
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Import Contacts</h1>
        <p className="mt-1 text-sm text-muted">
          Upload a CSV file and map columns to CRM fields. Existing contacts matched by email will be skipped.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <X size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Upload step */}
      {step === "upload" && (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-panel p-16 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <Upload className="mb-4 text-muted" size={40} />
          <p className="font-semibold">Drop your CSV here or click to browse</p>
          <p className="mt-1 text-sm text-muted">Accepts .csv files up to 10 MB — up to 10,000 contacts</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <button
            className="mt-5 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
          >
            Choose file
          </button>
        </div>
      )}

      {/* Mapping step */}
      {step === "map" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-panel p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">Column Mapping</p>
                <p className="text-sm text-muted">{rows.length} rows detected · {csvHeaders.length} columns</p>
              </div>
              <button
                onClick={() => setStep("upload")}
                className="text-xs text-muted hover:text-foreground"
              >
                Choose different file
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {CRM_FIELDS.map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                    {field.label} {"required" in field && field.required && <span className="text-red-500">*</span>}
                  </span>
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                  >
                    <option value="">— Skip this field —</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          {/* Tag on import */}
          <div className="rounded-xl border border-border bg-panel p-5 shadow-soft">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Tag all imported contacts (optional)
              </span>
              <input
                value={tagOnImport}
                onChange={(e) => setTagOnImport(e.target.value)}
                placeholder="e.g. Imported May 2026"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
              />
            </label>
          </div>

          {/* Preview */}
          {rows.length > 0 && mapping.firstName && (
            <div className="rounded-xl border border-border bg-panel overflow-hidden shadow-soft">
              <div className="border-b border-border px-5 py-3 text-sm font-semibold">Preview (first 3 rows)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-background text-muted border-b border-border">
                    <tr>
                      {CRM_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                        <th key={f.key} className="px-3 py-2 text-left font-semibold">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        {CRM_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                          <td key={f.key} className="px-3 py-2 text-muted">
                            {row[mapping[f.key] ?? ""] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              {rows.length} contact{rows.length !== 1 ? "s" : ""} will be imported
            </p>
            <button
              onClick={handleImport}
              disabled={!mapping.firstName}
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
            >
              <Upload size={14} />
              Import {rows.length} contacts
            </button>
          </div>
        </div>
      )}

      {/* Importing step */}
      {step === "importing" && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2 className="mb-4 animate-spin text-primary" size={40} />
          <p className="font-semibold">Importing contacts…</p>
          <p className="mt-1 text-sm text-muted">This may take a moment for large files.</p>
        </div>
      )}

      {/* Done step */}
      {step === "done" && result && (
        <div className="rounded-2xl border border-emerald-200 bg-white p-10 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-4 text-emerald-500" size={56} />
          <h2 className="text-2xl font-bold">Import Complete</h2>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-2xl font-bold text-emerald-700">{result.imported}</p>
              <p className="text-sm text-emerald-600">Imported</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
              <p className="text-sm text-amber-600">Skipped (duplicate)</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
              <p className="text-sm text-red-600">Errors</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-4 text-left rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 space-y-1">
              {result.errors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
              {result.errors.length > 5 && <div>…and {result.errors.length - 5} more</div>}
            </div>
          )}
          <Link
            href="/contacts"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
          >
            View contacts
          </Link>
        </div>
      )}
    </div>
  );
}
