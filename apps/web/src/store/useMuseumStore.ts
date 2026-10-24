import { create } from "zustand";
import type { Museum, Piece } from "@mus3o/shared";

type Phase = "prompt" | "loading" | "museum";

interface MuseumState {
  phase: Phase;
  museum: Museum | null;
  selectedPiece: Piece | null;
  error: string | null;
  setPhase: (phase: Phase) => void;
  setMuseum: (museum: Museum) => void;
  selectPiece: (piece: Piece | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useMuseumStore = create<MuseumState>((set) => ({
  phase: "prompt",
  museum: null,
  selectedPiece: null,
  error: null,
  setPhase: (phase) => set({ phase }),
  setMuseum: (museum) => set({ museum, phase: "museum", selectedPiece: null }),
  selectPiece: (selectedPiece) => set({ selectedPiece }),
  setError: (error) => set({ error }),
  reset: () => set({ phase: "prompt", museum: null, selectedPiece: null }),
}));
