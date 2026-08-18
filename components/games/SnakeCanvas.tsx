"use client";

import { useEffect, useRef } from "react";
import {
  SnakeEngine,
  SnakeState,
  SnakeInput,
  WORLD_W,
  WORLD_H,
} from "@/lib/games/snake/engine";
import { FRUITS_SRC } from "@/lib/games/snake/spriteAtlas";

type SnakeCanvasProps = {
  paused: boolean;
  onStateChange: (state: SnakeState) => void;
  onGameOver: (finalScore: number) => void;
  restartSignal: number;
};

const KEY_MAP: Record<string, keyof SnakeInput> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export default function SnakeCanvas({
  paused,
  onStateChange,
  onGameOver,
  restartSignal,
}: SnakeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SnakeEngine | null>(null);

  const pausedRef = useRef(paused);
  const onStateChangeRef = useRef(onStateChange);
  const onGameOverRef = useRef(onGameOver);

  const gameOverFiredRef = useRef(false);
  const isFirstRestart = useRef(true);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);
  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const engine = new SnakeEngine();
    engineRef.current = engine;
    gameOverFiredRef.current = false;

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) engine.setSprites(image);
    };
    image.src = FRUITS_SRC;

    const input: SnakeInput = {
      up: false,
      down: false,
      left: false,
      right: false,
    };

    const applyTransform = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      const pixelW = Math.max(1, Math.round(cssW * dpr));
      const pixelH = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW;
        canvas.height = pixelH;
      }
      ctx.setTransform(pixelW / WORLD_W, 0, 0, pixelH / WORLD_H, 0, 0);
    };

    applyTransform();
    const resizeObserver = new ResizeObserver(applyTransform);
    resizeObserver.observe(canvas);

    const handleKeyDown = (e: KeyboardEvent) => {
      const field = KEY_MAP[e.code];
      if (!field) return;
      e.preventDefault();
      input[field] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const field = KEY_MAP[e.code];
      if (!field) return;
      e.preventDefault();
      input[field] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    let rafId: number;
    let lastTime: number | null = null;

    const frame = (ts: number) => {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;

      if (!pausedRef.current) {
        engine.update(dt, input);
      }
      engine.draw(ctx);

      const state = engine.getState();
      onStateChangeRef.current(state);
      if (state.status === "gameover" && !gameOverFiredRef.current) {
        gameOverFiredRef.current = true;
        onGameOverRef.current(state.score);
      }

      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      image.onload = null;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isFirstRestart.current) {
      isFirstRestart.current = false;
      return;
    }
    engineRef.current?.reset();
    gameOverFiredRef.current = false;
  }, [restartSignal]);

  return (
    <div className="game-arena">
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </div>
  );
}
