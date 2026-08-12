import HomeClient from "@/components/HomeClient";
import { getGames } from "@/lib/data";

export default async function Home() {
  let games = null;
  try {
    games = await getGames();
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

  return <HomeClient games={games} />;
}
