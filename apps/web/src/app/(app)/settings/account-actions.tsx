"use client";

import { DELETE_ACCOUNT_CONFIRMATION } from "@elacharger/schemas";
import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { api, apiErrorMessage } from "@/lib/api";

export function AccountActions() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, startDeleting] = useTransition();
  const inputId = useId();

  const remove = () => {
    setError(null);
    startDeleting(async () => {
      const { response } = await api.POST("/account/delete", {
        body: { confirmation: DELETE_ACCOUNT_CONFIRMATION },
      });
      if (!response.ok) return setError(apiErrorMessage(response.status));
      // The session cookie is gone; pages render per request, so nothing of the account remains.
      router.replace("/login?deleted=1");
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <a
        href="/api/v1/account/export"
        download
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-input text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Download aria-hidden="true" className="size-4" />
        Descargar mis datos (JSON)
      </a>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-destructive/40 text-sm font-semibold text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Borrar mi cuenta
        </button>
      ) : (
        <div
          role="group"
          aria-labelledby={`${inputId}-title`}
          className="flex flex-col gap-3 rounded-xl border border-destructive/40 p-3"
        >
          <p id={`${inputId}-title`} className="text-sm font-semibold text-destructive">
            Se borrarán para siempre tu garaje, tus cálculos y tus recargas.
          </p>
          <label htmlFor={inputId} className="text-sm">
            Escribe <strong>{DELETE_ACCOUNT_CONFIRMATION}</strong> para confirmar.
          </label>
          <input
            id={inputId}
            value={typed}
            autoComplete="off"
            autoCapitalize="characters"
            onChange={(e) => setTyped(e.target.value)}
            className="min-h-11 rounded-xl border border-input bg-card px-3 text-[15px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setTyped("");
              }}
              className="min-h-11 rounded-xl border border-input text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={typed.trim().toUpperCase() !== DELETE_ACCOUNT_CONFIRMATION || deleting}
              onClick={remove}
              className="min-h-11 rounded-xl bg-destructive text-sm font-semibold text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
            >
              {deleting ? "Borrando…" : "Borrar para siempre"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
