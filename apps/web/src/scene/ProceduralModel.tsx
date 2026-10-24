import type { Part } from "@mus3o/shared";

function Geometry({ part }: { part: Part }) {
  const a = part.args;
  switch (part.shape) {
    case "box":
      return <boxGeometry args={[a[0] ?? 1, a[1] ?? 1, a[2] ?? 1]} />;
    case "cylinder":
      return <cylinderGeometry args={[a[0] ?? 0.5, a[1] ?? 0.5, a[2] ?? 1, a[3] ?? 12]} />;
    case "sphere":
      return <sphereGeometry args={[a[0] ?? 0.5, a[1] ?? 12, a[2] ?? 8]} />;
    case "cone":
      return <coneGeometry args={[a[0] ?? 0.5, a[1] ?? 1, a[2] ?? 12]} />;
  }
}

export default function ProceduralModel({ parts }: { parts: Part[] }) {
  return (
    <group>
      {parts.map((p, i) => (
        <mesh key={i} position={p.pos} rotation={p.rot}>
          <Geometry part={p} />
          <meshStandardMaterial color={p.color} flatShading />
        </mesh>
      ))}
    </group>
  );
}
