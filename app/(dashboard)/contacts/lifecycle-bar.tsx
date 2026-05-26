"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  leadCount: number;
  customerCount: number;
  inactiveCount: number;
  activeStatus: string;
};

type Stage = {
  key: string;
  label: string;
  count: number;
  activeClass: string;
  inactiveClass: string;
};

export function LifecycleBar({ leadCount, customerCount, inactiveCount, activeStatus }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (activeStatus === status) {
      params.delete("status");
    } else {
      params.set("status", status);
      params.delete("page");
    }
    router.push(`/contacts?${params.toString()}`);
  }

  const stages: Stage[] = [
    {
      key: "LEAD",
      label: "Lead",
      count: leadCount,
      activeClass: "bg-amber-500 text-white border-amber-500",
      inactiveClass: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
    },
    {
      key: "CUSTOMER",
      label: "Customer",
      count: customerCount,
      activeClass: "bg-emerald-500 text-white border-emerald-500",
      inactiveClass: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
    },
    {
      key: "INACTIVE",
      label: "Inactive",
      count: inactiveCount,
      activeClass: "bg-slate-500 text-white border-slate-500",
      inactiveClass: "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {stages.map((stage, idx) => (
        <div key={stage.key} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(stage.key)}
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              activeStatus === stage.key ? stage.activeClass : stage.inactiveClass
            }`}
          >
            {stage.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                activeStatus === stage.key
                  ? "bg-white/25 text-inherit"
                  : "bg-white/70 text-inherit"
              }`}
            >
              {stage.count.toLocaleString()}
            </span>
          </button>
          {idx < stages.length - 1 && (
            <span className="text-muted text-sm font-medium">→</span>
          )}
        </div>
      ))}
    </div>
  );
}
