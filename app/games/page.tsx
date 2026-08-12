import GamesLibraryClient, {
  type GameWithBest,
} from "@/components/GamesLibraryClient";
import { getBestScore, getGames } from "@/lib/data";

export default async function GamesPage() {
  let games: GameWithBest[] | null = null;
  try {
    const base = await getGames();
    games = await Promise.all(
      base.map(async (g) => ({ ...g, best: await getBestScore(g.id) }))
    );
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
          No pudimos cargar el catálogo. Intenta de nuevo más tarde.
        </div>
      </div>
    );
  }

  return <GamesLibraryClient games={games} />;
}
