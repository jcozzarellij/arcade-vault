import type React from "react";
import AsteroidesCanvas from "@/components/games/AsteroidesCanvas";
import type { AsteroidesState } from "@/lib/games/asteroides/engine";
import TetrisCanvas from "@/components/games/TetrisCanvas";
import type { TetrisState } from "@/lib/games/tetris/engine";
import ArkanoidCanvas from "@/components/games/ArkanoidCanvas";
import SnakeCanvas from "@/components/games/SnakeCanvas";
import type { SnakeState } from "@/lib/games/snake/engine";

export type GameCanvasProps = {
  paused: boolean;
  onStateChange: (state: unknown) => void;
  onGameOver: (finalScore: number) => void;
  restartSignal: number;
};

export type GameEntry = {
  Canvas: React.ComponentType<GameCanvasProps>;
  hasLives: boolean;
  extraStat?: { label: string; select: (state: unknown) => string | null };
};

export const GAME_REGISTRY: Record<string, GameEntry> = {
  asteroids: {
    Canvas: AsteroidesCanvas,
    hasLives: true,
    extraStat: {
      label: "Disparo triple",
      select: (s) => {
        const st = s as AsteroidesState;
        return st.tripleShotRemaining > 0
          ? `${st.tripleShotRemaining.toFixed(1)}s`
          : null;
      },
    },
  },
  tetris: {
    Canvas: TetrisCanvas,
    hasLives: false,
    extraStat: {
      label: "Líneas",
      select: (s) => String((s as TetrisState).lines),
    },
  },
  arkanoid: {
    Canvas: ArkanoidCanvas,
    hasLives: true,
  },
  snake: {
    Canvas: SnakeCanvas,
    hasLives: false,
    extraStat: {
      label: "Longitud",
      select: (s) => String((s as SnakeState).length),
    },
  },
};
