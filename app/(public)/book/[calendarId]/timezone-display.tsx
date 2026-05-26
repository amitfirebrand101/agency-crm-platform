"use client";

export function TimezoneDisplay() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return <p className="text-xs text-gray-500 mt-1">Times shown in: {tz}</p>;
}
