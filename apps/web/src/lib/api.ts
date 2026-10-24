import { MuseumSchema, MuseumStreamEventSchema, type Museum, type MuseumStreamEvent } from "@mus3o/shared";

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

/** Mensaje para el usuario según el estado HTTP de un fallo de la IA (el mismo con y sin streaming). */
export function describeAiError(status?: number): string {
  return status === 503
    ? "La IA no está configurada en el servidor. Puedes construir el palacio sin IA."
    : status === 429
      ? "Demasiadas solicitudes. Intenta en un minuto."
      : "No pudimos generar el palacio con IA. Intenta de nuevo o constrúyelo sin IA.";
}

/** Parte un flujo de texto en líneas completas; lo que queda sin salto de línea espera al siguiente trozo. */
export function createLineSplitter() {
  let rest = "";
  return {
    push(chunk: string): string[] {
      rest += chunk;
      const lines = rest.split("\n");
      rest = lines.pop() ?? "";
      return lines.filter((l) => l.trim() !== "");
    },
    flush(): string[] {
      const last = rest.trim();
      rest = "";
      return last ? [last] : [];
    },
  };
}

function parseStreamLine(line: string): MuseumStreamEvent {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    throw new ApiError("Respuesta de la IA inválida", 502);
  }
  // Cada evento se valida igual que cualquier entrada externa.
  const parsed = MuseumStreamEventSchema.safeParse(json);
  if (!parsed.success) throw new ApiError("La IA devolvió un palacio inválido", 502);
  return parsed.data;
}

/**
 * Genera el museo en streaming (`POST /api/generate-museum/stream`, NDJSON) y entrega cada evento según llega.
 * Falla antes del primer evento con `ApiError` (estado HTTP); si la conexión se corta sin `done` ni `error`
 * lanza `ApiError` 502. El evento `error` se entrega como evento y el flujo termina.
 */
export async function* generateMuseumStream(text: string, signal?: AbortSignal): AsyncGenerator<MuseumStreamEvent> {
  const body = looksLikeTopic(text) ? { topic: text.trim() } : { notes: text.trim() };
  const res = await fetch("/api/generate-museum/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError((data as { error?: string }).error ?? `Error ${res.status}`, res.status || 502);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const splitter = createLineSplitter();
  let ended = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      const lines = done ? splitter.flush() : splitter.push(decoder.decode(value, { stream: true }));
      for (const line of lines) {
        const event = parseStreamLine(line);
        yield event;
        if (event.type === "done" || event.type === "error") {
          ended = true;
          return;
        }
      }
      if (done) break;
    }
  } finally {
    // Si el consumidor deja de leer (o aborta), se cierra la conexión.
    void reader.cancel().catch(() => undefined);
  }
  if (!ended) throw new ApiError("Se cortó la conexión con la IA", 502);
}
