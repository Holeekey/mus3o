import { MuseumSchema, type Museum } from "@mus3o/shared";

export async function generateMuseum(topic: string): Promise<Museum> {
  const res = await fetch("/api/generate-museum", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
  return MuseumSchema.parse(data);
}
