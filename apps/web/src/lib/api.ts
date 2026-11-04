import { createApiClient } from "@elacharger/api-client";

/** Same-origin API client for client components; the session cookie authenticates it. */
export const api = createApiClient({ baseUrl: "" });

/** Spanish message for a failed API call. */
export function apiErrorMessage(status: number | undefined): string {
  switch (status) {
    case 401:
      return "Tu sesión expiró. Vuelve a iniciar sesión.";
    case 404:
      return "No encontramos ese registro; puede que ya no exista.";
    case 409:
      return "Esto ya se había guardado.";
    case 422:
      return "Revisa los datos: hay valores fuera de rango.";
    case 429:
      return "Llegaste al límite de búsquedas de hoy. Intenta mañana.";
    default:
      return "Algo falló. Revisa tu conexión e intenta de nuevo.";
  }
}
