import { notFound } from "next/navigation";
import GamePlayerClient from "@/components/GamePlayerClient";
import { getGameById } from "@/lib/data";

export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let game = null;
  let fetchFailed = false;
  try {
    game = await getGameById(id);
  } catch {
    game = null;
    fetchFailed = true;
  }

  if (fetchFailed) {
    return (
      <div className="fade-in" style={{ textAlign: "center", padding: 80 }}>
        <div
          className="pixel neon-magenta"
          style={{ fontSize: 14, marginBottom: 12 }}
        >
          ERROR DE CONEXIÓN
        </div>
        <div style={{ color: "var(--ink-faint)" }}>
          No pudimos cargar este juego. Intenta de nuevo más tarde.
        </div>
      </div>
    );
  }

  if (!game) notFound();

  return <GamePlayerClient game={game} />;
}
