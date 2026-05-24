"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "Saving…",
  pendingClassName,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingText?: string;
  pendingClassName?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      {...rest}
      type="submit"
      disabled={pending || rest.disabled}
      aria-disabled={pending}
      className={`${pending ? (pendingClassName ?? className) : className} ${pending ? "opacity-70 cursor-wait" : ""}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
