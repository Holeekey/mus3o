/**
 * Resume un error de ElevenLabs para el log del servidor: estado HTTP y `detail.code` (p. ej. `quota_exceeded`).
 * Nunca devuelve el cuerpo completo (puede incluir datos de la cuenta) ni se reenvía al cliente.
 */
export async function describeUpstreamError(res: Response): Promise<string> {
  let code = "";
  try {
    const body = (await res.json()) as { detail?: { code?: unknown; status?: unknown } | unknown };
    const detail = body?.detail as { code?: unknown; status?: unknown } | undefined;
    const raw = typeof detail?.code === "string" ? detail.code : typeof detail?.status === "string" ? detail.status : "";
    if (/^[a-z0-9_]{1,60}$/i.test(raw)) code = raw;
  } catch {
    /* cuerpo vacío o que no es JSON */
  }
  return code ? `HTTP ${res.status} (${code})` : `HTTP ${res.status}`;
}
