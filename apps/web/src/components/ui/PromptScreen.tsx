import { useState, type FormEvent } from "react";
import { useMuseumStore } from "../../store/useMuseumStore";
import { generateMuseum } from "../../lib/api";
import { demoMuseum, fallbackMuseum } from "../../mocks";

export default function PromptScreen() {
  const [topic, setTopic] = useState("");
  const { setPhase, setMuseum, setError, error } = useMuseumStore();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = topic.trim();
    if (!t) return;
    setError(null);
    setPhase("loading");
    try {
      setMuseum(await generateMuseum(t));
    } catch (err) {
      console.error(err);
      setError("No se pudo generar el mus3o; mostrando uno de ejemplo.");
      setMuseum(fallbackMuseum(t));
    }
  }

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-stone-900 to-stone-950 px-4 text-stone-100">
      <h1 className="text-4xl font-bold tracking-tight">Mus3o 3D</h1>
      <p className="max-w-md text-center text-stone-400">Escribe un tema y recorre un mus3o generado a tu medida.</p>
      <form onSubmit={onSubmit} className="flex w-full max-w-lg gap-2">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={200}
          placeholder="Ej. Imperio romano"
          className="flex-1 rounded-lg border border-stone-700 bg-stone-800 px-4 py-3 outline-none focus:border-amber-500"
          autoFocus
        />
        <button className="rounded-lg bg-amber-600 px-5 py-3 font-semibold hover:bg-amber-500 disabled:opacity-50" disabled={!topic.trim()}>
          Crear
        </button>
      </form>
      <button
        type="button"
        onClick={() => setMuseum(demoMuseum)}
        className="rounded-lg border border-stone-600 px-4 py-2 text-sm text-stone-300 hover:border-amber-500 hover:text-amber-400"
      >
        Ir directo al 3D (demo sin consulta)
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </main>
  );
}
