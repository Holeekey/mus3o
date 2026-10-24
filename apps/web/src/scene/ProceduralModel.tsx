import type { Part } from "@mus3o/shared";

// El modelo lo diseña la IA: se acotan medidas y segmentos para que ninguna receta
// pueda generar geometría gigante o demasiado pesada.
const size = (v: number | undefined, d: number) => Math.min(Math.max(v ?? d, 0.01), 4);
const segs = (v: number | undefined, d: number) => Math.min(Math.max(Math.round(v ?? d), 3), 24);

function Geometry({ part }: { part: Part }) {
  const a = part.args;
  switch (part.shape) {
    case "box":
      return <boxGeometry args={[size(a[0], 1), size(a[1], 1), size(a[2], 1)]} />;
    case "cylinder":
      return <cylinderGeometry args={[size(a[0], 0.5), size(a[1], 0.5), size(a[2], 1), segs(a[3], 8)]} />;
    case "sphere":
      return <sphereGeometry args={[size(a[0], 0.5), segs(a[1], 8), segs(a[2], 6)]} />;
    case "cone":
      return <coneGeometry args={[size(a[0], 0.5), size(a[1], 1), segs(a[2], 8)]} />;
  }
}

export default function ProceduralModel({ parts, emissive }: { parts: Part[]; emissive?: number }) {
  return (
    <group>
      {parts.map((p, i) => (
        <mesh key={i} position={p.pos} rotation={p.rot}>
          <Geometry part={p} />
          <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={emissive ?? 0.15} flatShading />
        </mesh>
      ))}
    </group>
  );
}
