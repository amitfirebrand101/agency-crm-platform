"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type NavWindow = Window & { __navStart?: () => void };

export function RouteProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPathname = useRef(pathname);

  function start() {
    if (timerRef.current) clearInterval(timerRef.current);
    setVisible(true);
    setProgress(12);
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 85) {
          clearInterval(timerRef.current!);
          return 85;
        }
        return Math.min(85, p + Math.random() * 18);
      });
    }, 280);
  }

  function complete() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setProgress(100);
    const t = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 280);
    return () => clearTimeout(t);
  }

  useEffect(() => {
    (window as NavWindow).__navStart = start;
    return () => {
      (window as NavWindow).__navStart = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      complete();
    }
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-[2px] bg-primary transition-[width] duration-300 ease-out"
      style={{ width: `${progress}%` }}
    />
  );
}
