"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Two-step delete through the API, then refreshes the page. */
export function DeleteButton({
  path,
  label,
  redirectTo,
}: {
  path: string;
  label: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      const response = await fetch(`/api/v1${path}`, { method: "DELETE" });
      if (!response.ok) {
        setError(true);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Eliminar ${label}`}
        className="flex size-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Trash2 aria-hidden="true" className="size-5" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      className="min-h-11 rounded-xl bg-destructive px-3 text-sm font-semibold text-white disabled:opacity-60"
    >
      {pending ? "Eliminando…" : error ? "Reintentar" : "Eliminar"}
    </button>
  );
}
