"use client";

import { useTransition, useState } from "react";
import { searchTwilioNumbers, provisionTwilioNumber } from "./actions";
import type { NumberSearchResult } from "./actions";

export function NumberProvisioner() {
  const [searchPending, startSearch] = useTransition();
  const [provisionPending, startProvision] = useTransition();
  const [results, setResults] = useState<NumberSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [provisionSuccess, setProvisionSuccess] = useState<string | null>(null);
  const [provisioningNumber, setProvisioningNumber] = useState<string | null>(null);

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSearchError(null);
    setResults([]);
    setProvisionError(null);
    setProvisionSuccess(null);

    startSearch(async () => {
      const res = await searchTwilioNumbers(fd);
      if ("error" in res) {
        setSearchError(res.error);
      } else {
        setResults(res.numbers);
        if (res.numbers.length === 0) {
          setSearchError("No numbers found for that area code. Try a different one.");
        }
      }
    });
  }

  function handleProvision(number: string) {
    setProvisionError(null);
    setProvisionSuccess(null);
    setProvisioningNumber(number);

    const fd = new FormData();
    fd.set("number", number);

    startProvision(async () => {
      const res = await provisionTwilioNumber(fd);
      setProvisioningNumber(null);
      if (res.ok) {
        setProvisionSuccess(`${number} successfully added to your account.`);
        setResults((prev) => prev.filter((n) => n.number !== number));
      } else {
        setProvisionError(res.error ?? "Failed to provision number.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          maxLength={3}
          minLength={3}
          name="areaCode"
          pattern="\d{3}"
          placeholder="Area code (e.g. 415)"
          required
          type="text"
        />
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={searchPending}
          type="submit"
        >
          {searchPending ? "Searching…" : "Search"}
        </button>
      </form>

      {searchError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchError}
        </p>
      ) : null}

      {provisionSuccess ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {provisionSuccess}
        </p>
      ) : null}

      {provisionError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {provisionError}
        </p>
      ) : null}

      {results.length > 0 ? (
        <div className="divide-y divide-border rounded-md border border-border">
          {results.map((n) => (
            <div className="flex items-center justify-between px-3 py-2.5" key={n.number}>
              <div>
                <span className="font-mono text-sm font-medium">{n.number}</span>
                {n.locality || n.region ? (
                  <span className="ml-2 text-xs text-muted">
                    {[n.locality, n.region].filter(Boolean).join(", ")}
                  </span>
                ) : null}
                <div className="mt-0.5 flex gap-1">
                  {n.capabilities.sms ? (
                    <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted border border-border">SMS</span>
                  ) : null}
                  {n.capabilities.voice ? (
                    <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted border border-border">Voice</span>
                  ) : null}
                  {n.capabilities.mms ? (
                    <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted border border-border">MMS</span>
                  ) : null}
                </div>
              </div>
              <button
                className="rounded-md border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-60"
                disabled={provisionPending}
                onClick={() => handleProvision(n.number)}
                type="button"
              >
                {provisionPending && provisioningNumber === n.number ? "Adding…" : "Get this number"}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
