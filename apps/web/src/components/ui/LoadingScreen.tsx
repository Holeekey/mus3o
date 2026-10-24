export default function LoadingScreen() {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-stone-950 text-stone-200">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-stone-700 border-t-amber-500" />
      <p>Construyendo tu mus3o…</p>
    </div>
  );
}
