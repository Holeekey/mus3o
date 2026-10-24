import { lazy, Suspense } from "react";
import { useMuseumStore } from "./store/useMuseumStore";
import PromptScreen from "./components/ui/PromptScreen";
import LoadingScreen from "./components/ui/LoadingScreen";
import HUD from "./components/ui/HUD";

const MuseumCanvas = lazy(() => import("./components/museum/MuseumCanvas"));

export default function App() {
  const phase = useMuseumStore((s) => s.phase);
  const museum = useMuseumStore((s) => s.museum);

  if (phase === "prompt") return <PromptScreen />;
  if (phase === "loading" || !museum) return <LoadingScreen />;
  return (
    <div className="relative h-full w-full">
      <Suspense fallback={<LoadingScreen />}>
        <MuseumCanvas museum={museum} />
      </Suspense>
      <HUD museum={museum} />
    </div>
  );
}
