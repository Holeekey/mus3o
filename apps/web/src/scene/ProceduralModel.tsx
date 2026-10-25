import { useMemo } from "react";
import type { Part } from "@mus3o/shared";
import { fitParts } from "./fitModel";
import { liftColor } from "./liftColor";

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

// Conserva los colores de cada parte, pero mates y sin brillo propio: la forma la dibuja la luz.
// Se normaliza el tamaño: centrado, apoyado en y = 0 y de ~2 m en su dimensión mayor, sea cual sea la escala que dibujó la IA.
export default function ProceduralModel({ parts }: { parts: Part[] }) {
  const fit = useMemo(() => fitParts(parts), [parts]);
  return (
    <group position={fit.offset} scale={fit.scale}>
      {parts.map((p, i) => (
        <mesh key={i} position={p.pos} rotation={p.rot} castShadow receiveShadow>
          <Geometry part={p} />
          <meshStandardMaterial color={liftColor(p.color)} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
}
