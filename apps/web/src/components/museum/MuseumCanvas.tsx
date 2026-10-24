import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import type { Museum } from "@mus3o/shared";
import Room from "./Room";
import Player from "./Player";
import { EYE_HEIGHT } from "./layout";

export default function MuseumCanvas({ museum }: { museum: Museum }) {
  const palette = museum.theme.palette;
  const fogColor = palette[palette.length - 1];

  return (
    <Canvas camera={{ fov: 70, position: [0, EYE_HEIGHT, 6] }} className="!absolute inset-0">
      <color attach="background" args={[fogColor]} />
      <fog attach="fog" args={[fogColor, 8, 40]} />
      <ambientLight intensity={0.6} color="#9bb4d6" />
      <directionalLight position={[5, 8, 4]} intensity={1.2} color="#ffd9a0" />
      {museum.rooms.map((room, i) => (
        <Room key={room.id} room={room} index={i} isLast={i === museum.rooms.length - 1} palette={palette} />
      ))}
      <Player museum={museum} />
      <EffectComposer>
        <Bloom intensity={0.3} luminanceThreshold={0.85} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.7} />
      </EffectComposer>
    </Canvas>
  );
}
