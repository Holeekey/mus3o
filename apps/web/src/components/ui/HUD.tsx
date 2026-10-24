import type { Museum } from "@mus3o/shared";
import { useMuseumStore } from "../../store/useMuseumStore";

export default function HUD({ museum }: { museum: Museum }) {
  const reset = useMuseumStore((s) => s.reset);
  return (
    <div className="pointer-events-none absolute inset-0 text-stone-100">
      <div className="absolute left-4 top-4 rounded bg-black/50 px-3 py-2">
        <h2 className="font-semibold">{museum.title}</h2>
        <p className="text-xs text-stone-300">Clic para mirar · WASD para moverte · Esc para soltar el ratón</p>
      </div>
      <button onClick={reset} className="pointer-events-auto absolute right-4 top-4 rounded bg-black/50 px-3 py-2 text-sm hover:bg-black/70">
        Nuevo mus3o
      </button>
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
    </div>
  );
}
