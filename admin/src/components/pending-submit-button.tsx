"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  pendingLabel: string;
  className: string;
};

export function PendingSubmitButton({ children, disabled = false, pendingLabel, className }: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" aria-busy={pending} disabled={pending || disabled} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
