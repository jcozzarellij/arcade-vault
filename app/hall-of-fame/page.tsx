import HallOfFameClient from "@/components/HallOfFameClient";
import { getGames, getTopScores, type ScoreRow } from "@/lib/data";

export default async function HallOfFamePage() {
  let games = null;
  let scoresByGame: Record<string, ScoreRow[]> = {};
  try {
    games = await getGames();
    const entries = await Promise.all(
      games.map(async (g) => [g.id, await getTopScores(g.id)] as const)
    );
    scoresByGame = Object.fromEntries(entries);
  } catch {
    games = null;
  }

  if (!games) {
    return (
      <div className="fade-in" style={{ textAlign: "center", padding: 80 }}>
        <div
          className="pixel neon-magenta"
          style={{ fontSize: 14, marginBottom: 12 }}
        >
          ERROR DE CONEXIÓN
        </div>
        <div style={{ color: "var(--ink-faint)" }}>
          No pudimos cargar el salón de la fama. Intenta de nuevo más tarde.
        </div>
      </div>
    );
  }

  return <HallOfFameClient games={games} scoresByGame={scoresByGame} />;
}
