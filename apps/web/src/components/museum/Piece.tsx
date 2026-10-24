import { Suspense, useEffect, useState } from "react";
import { Float, Html, useGLTF } from "@react-three/drei";
import type { Piece as PieceData } from "@mus3o/shared";
import ProceduralModel from "./ProceduralModel";
import InfoPanel from "../ui/InfoPanel";
import { useMuseumStore } from "../../store/useMuseumStore";

type Catalog = Record<string, { url: string; scale?: number }>;
let catalogPromise: Promise<Catalog> | undefined;

function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => {
    catalogPromise ??= fetch("/models/catalog.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    catalogPromise.then(setCatalog);
  }, []);
  return catalog;
}

function GlbModel({ url, scale = 1 }: { url: string; scale?: number }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene.clone()} scale={scale} />;
}

function LabeledCube({ label }: { label: string }) {
  return (
    <group>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial color="#ff00ff" flatShading />
      </mesh>
      <Html position={[0, 1, 0]} center distanceFactor={8}>
        <span className="rounded bg-black/70 px-1 text-xs text-white">{label}</span>
      </Html>
    </group>
  );
}

function CatalogModel({ id }: { id: string }) {
  const catalog = useCatalog();
  const entry = catalog?.[id];
  if (!entry) return <LabeledCube label={id} />;
  return (
    <Suspense fallback={<LabeledCube label={id} />}>
      <GlbModel url={entry.url} scale={entry.scale} />
    </Suspense>
  );
}

export default function Piece({ piece }: { piece: PieceData }) {
  const selected = useMuseumStore((s) => s.selectedPiece?.id === piece.id);
  const [x, y, z] = piece.position;

  return (
    <group position={[x, 0, z]}>
      {/* Pedestal */}
      <mesh position={[0, y / 2, 0]}>
        <boxGeometry args={[1.2, y, 1.2]} />
        <meshStandardMaterial color="#d6d3d1" flatShading />
      </mesh>
      <Float speed={2} rotationIntensity={0.4} floatIntensity={0.3} floatingRange={[0, 0.15]}>
        <group position={[0, y + 0.2, 0]}>
          {piece.model.type === "procedural" ? <ProceduralModel parts={piece.model.parts} /> : <CatalogModel id={piece.model.id} />}
        </group>
      </Float>
      {selected && (
        <Html position={[0, y + 2.6, 0]} center zIndexRange={[10, 0]}>
          <InfoPanel piece={piece} />
        </Html>
      )}
    </group>
  );
}
