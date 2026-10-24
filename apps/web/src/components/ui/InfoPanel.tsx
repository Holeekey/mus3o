import type { Piece } from "@mus3o/shared";

export default function InfoPanel({ piece }: { piece: Piece }) {
  return (
    <div className="pointer-events-none w-72 rounded-lg border border-amber-500/40 bg-stone-900/90 p-4 text-stone-100 shadow-xl">
      <h3 className="text-lg font-semibold text-amber-400">{piece.title}</h3>
      <p className="mt-1 text-sm">{piece.text}</p>
      <p className="mt-2 border-t border-stone-700 pt-2 text-xs italic text-stone-300">💡 {piece.fact}</p>
    </div>
  );
}
