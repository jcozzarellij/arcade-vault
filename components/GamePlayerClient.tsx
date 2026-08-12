"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { Game } from "@/lib/data";
import { saveScore, useStoredUser } from "@/lib/session";
import { GAME_REGISTRY } from "@/components/games/registry";

const DEMO_SCORE = 15420;
const DEMO_LIVES = 3;
const DEMO_LEVEL = 2;

type EngineStateShape = {
  score?: number;
  level?: number;
  lives?: number;
};

export default function GamePlayerClient({ game }: { game: Game }) {
  const storedUser = useStoredUser();
  const entry = GAME_REGISTRY[game.id];

  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [engineState, setEngineState] = useState<unknown>(null);
  const [restartSignal, setRestartSignal] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const name = nameOverride ?? storedUser?.name ?? "INVITADO";

  const handleStateChange = useCallback(
    (state: unknown) => setEngineState(state),
    []
  );
  const handleGameOver = useCallback((score: number) => {
    setFinalScore(score);
    setOver(true);
  }, []);

  const liveState = engineState as EngineStateShape | null;
  const score = entry ? (liveState?.score ?? 0) : DEMO_SCORE;
  const lives = entry ? (liveState?.lives ?? 0) : DEMO_LIVES;
  const level = entry ? (liveState?.level ?? 1) : DEMO_LEVEL;
  const displayedFinalScore = entry ? finalScore : DEMO_SCORE;
  const showLives = entry ? entry.hasLives : true;
  const extraStatValue =
    entry?.extraStat && engineState !== null
      ? entry.extraStat.select(engineState)
      : null;

  const restart = () => {
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaveError(null);
    if (entry) setRestartSignal((s) => s + 1);
  };

  const handleEndClick = () => {
    if (entry) {
      setFinalScore(liveState?.score ?? 0);
      setPaused(true);
    }
    setOver(true);
  };

  const handleSaveScore = async () => {
    setSaving(true);
    setSaveError(null);
    const result = await saveScore({
      game: game.id,
      score: displayedFinalScore,
      name,
    });
    setSaving(false);
    if (result.ok) {
      setSaved(true);
    } else {
      setSaveError(result.error);
    }
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          {showLives && (
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
            </div>
          )}
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {extraStatValue !== null && (
            <div className="hud-stat">
              <div className="l">{entry?.extraStat?.label}</div>
              <div className="v" style={{ color: "var(--cyan)" }}>
                {extraStatValue}
              </div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={handleEndClick}>
            {entry ? "RENDIRSE" : "FIN"}
          </button>
          <Link href={`/game/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {entry ? (
            <entry.Canvas
              paused={paused}
              onStateChange={handleStateChange}
              onGameOver={handleGameOver}
              restartSignal={restartSignal}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">
              {displayedFinalScore.toLocaleString("es-ES")}
            </div>
            {entry ? (
              !saved ? (
                <div className="input-row">
                  <input
                    value={name}
                    onChange={(e) =>
                      setNameOverride(e.target.value.toUpperCase().slice(0, 10))
                    }
                    placeholder="TUS INICIALES"
                  />
                  <button
                    className="btn yellow"
                    onClick={handleSaveScore}
                    disabled={saving}
                  >
                    {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                  </button>
                  {saveError && (
                    <div
                      className="mono"
                      style={{
                        color: "var(--magenta)",
                        fontSize: 11,
                        marginTop: 8,
                      }}
                    >
                      ▸ ERROR AL GUARDAR: {saveError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
              )
            ) : (
              <div
                className="mono"
                style={{
                  color: "var(--ink-faint)",
                  fontSize: 11,
                  marginTop: 8,
                }}
              >
                ▸ ESTE JUEGO AÚN NO GUARDA PUNTUACIONES
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/games" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
