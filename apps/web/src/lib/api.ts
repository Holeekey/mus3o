import { MuseumSchema, type Museum } from "@mus3o/shared";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Una línea corta se trata como tema; cualquier otra cosa, como apuntes. */
export const looksLikeTopic = (text: string) => !text.includes("\n") && text.trim().length <= 200;

export async function generateMuseum(text: string, signal?: AbortSignal): Promise<Museum> {
  const body = looksLikeTopic(text) ? { topic: text.trim() } : { notes: text.trim() };
  const res = await fetch("/api/generate-museum", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `Error ${res.status}`, res.status);
  // La respuesta se valida igual que cualquier entrada externa.
  const parsed = MuseumSchema.safeParse(data);
  if (!parsed.success) throw new ApiError("La IA devolvió un palacio inválido", 502);
  return parsed.data;
}
