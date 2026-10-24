import type { Room as RoomData } from "@mus3o/shared";
import Piece from "./Piece";
import { DOOR_H, DOOR_W, ROOM_D, ROOM_H, ROOM_W, roomOrigin } from "./layout";

interface Props {
  room: RoomData;
  index: number;
  isLast: boolean;
  palette: string[];
}

const T = 0.3; // grosor de pared

function Wall({ pos, size, color }: { pos: [number, number, number]; size: [number, number, number]; color: string }) {
  return (
    <mesh position={pos}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} flatShading />
    </mesh>
  );
}

/** Pared perpendicular a x, con o sin hueco de puerta centrado. */
function SideWall({ x, door, color }: { x: number; door: boolean; color: string }) {
  if (!door) return <Wall pos={[x, ROOM_H / 2, 0]} size={[T, ROOM_H, ROOM_D]} color={color} />;
  const seg = (ROOM_D - DOOR_W) / 2;
  const off = DOOR_W / 2 + seg / 2;
  return (
    <>
      <Wall pos={[x, ROOM_H / 2, -off]} size={[T, ROOM_H, seg]} color={color} />
      <Wall pos={[x, ROOM_H / 2, off]} size={[T, ROOM_H, seg]} color={color} />
      <Wall pos={[x, DOOR_H + (ROOM_H - DOOR_H) / 2, 0]} size={[T, ROOM_H - DOOR_H, DOOR_W]} color={color} />
    </>
  );
}

export default function Room({ room, index, isLast, palette }: Props) {
  const wall = palette[0];
  const floor = palette[2] ?? palette[1];
  const ceiling = palette[1];

  return (
    <group position={roomOrigin(index)}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color={floor} flatShading />
      </mesh>
      <mesh position={[0, ROOM_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color={ceiling} flatShading />
      </mesh>
      <Wall pos={[0, ROOM_H / 2, -ROOM_D / 2]} size={[ROOM_W, ROOM_H, T]} color={wall} />
      <Wall pos={[0, ROOM_H / 2, ROOM_D / 2]} size={[ROOM_W, ROOM_H, T]} color={wall} />
      {index === 0 && <SideWall x={-ROOM_W / 2} door={false} color={wall} />}
      <SideWall x={ROOM_W / 2} door={!isLast} color={wall} />
      <pointLight position={[0, ROOM_H - 0.5, 0]} intensity={20} distance={14} color="#ffe2b8" />
      {room.pieces.map((p) => (
        <Piece key={p.id} piece={p} />
      ))}
    </group>
  );
}
