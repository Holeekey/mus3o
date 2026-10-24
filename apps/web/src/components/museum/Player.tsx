import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import { Vector3 } from "three";
import type { Museum, Piece } from "@mus3o/shared";
import { useMuseumStore } from "../../store/useMuseumStore";
import { DOOR_W, EYE_HEIGHT, ROOM_D, ROOM_W } from "./layout";

const SPEED = 4;
const MARGIN = 0.6;
const NEAR = 3.2;

export default function Player({ museum }: { museum: Museum }) {
  const camera = useThree((s) => s.camera);
  const keys = useRef(new Set<string>());
  const selectPiece = useMuseumStore((s) => s.selectPiece);
  const lastId = useRef<string | null>(null);
  const dir = useMemo(() => new Vector3(), []);
  const side = useMemo(() => new Vector3(), []);

  const roomCount = museum.rooms.length;
  const minX = -ROOM_W / 2 + MARGIN;
  const maxX = (roomCount - 1) * ROOM_W + ROOM_W / 2 - MARGIN;
  const maxZ = ROOM_D / 2 - MARGIN;

  const pieces = useMemo(
    () =>
      museum.rooms.flatMap((r, i) =>
        r.pieces.map((p) => ({ piece: p as Piece, x: i * ROOM_W + p.position[0], z: p.position[2] })),
      ),
    [museum],
  );

  useEffect(() => {
    camera.position.set(0, EYE_HEIGHT, maxZ - 1);
    const down = (e: KeyboardEvent) => keys.current.add(e.code);
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      selectPiece(null);
    };
  }, [camera, maxZ, selectPiece]);

  useFrame((_, delta) => {
    const k = keys.current;
    const fwd = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    const strafe = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);

    if (fwd || strafe) {
      camera.getWorldDirection(dir);
      dir.y = 0;
      dir.normalize();
      side.crossVectors(dir, camera.up).normalize();
      const step = SPEED * Math.min(delta, 0.1);
      const prevX = camera.position.x;
      let x = prevX + (dir.x * fwd + side.x * strafe) * step;
      let z = camera.position.z + (dir.z * fwd + side.z * strafe) * step;

      x = Math.min(maxX, Math.max(minX, x));
      z = Math.min(maxZ, Math.max(-maxZ, z));

      // Paredes divisorias entre salas: solo se cruzan por la puerta.
      for (let i = 0; i < roomCount - 1; i++) {
        const wallX = i * ROOM_W + ROOM_W / 2;
        const crossing = (prevX - wallX) * (x - wallX) < 0 || Math.abs(x - wallX) < 0.4;
        if (crossing && Math.abs(z) > DOOR_W / 2 - 0.4) x = prevX;
      }
      camera.position.set(x, EYE_HEIGHT, z);
    }

    // Pieza más cercana dentro del radio de interacción.
    let nearest: Piece | null = null;
    let best = NEAR;
    for (const { piece, x, z } of pieces) {
      const d = Math.hypot(camera.position.x - x, camera.position.z - z);
      if (d < best) {
        best = d;
        nearest = piece;
      }
    }
    const id = nearest?.id ?? null;
    if (id !== lastId.current) {
      lastId.current = id;
      selectPiece(nearest);
    }
  });

  return <PointerLockControls />;
}
