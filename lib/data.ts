import { createClient as createServerClient } from "@/utils/supabase/server";

export { CATS } from "@/lib/game-types";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  plays: string;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

function formatScoreDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getUTCFullYear()}`;
}

const GAME_COLUMNS = "id, title, short, long, cat, cover, color, plays";

export async function getGames(): Promise<Game[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Game[];
}

export async function getGameById(id: string): Promise<Game | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Game | null;
}

export async function getTopScores(
  gameId: string,
  limit = 12
): Promise<ScoreRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("scores")
    .select("name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row, i) => ({
    rank: i + 1,
    name: row.name,
    score: row.score,
    date: formatScoreDate(row.created_at),
  }));
}

export async function getBestScore(gameId: string): Promise<number> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("scores")
    .select("score")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.score ?? 0;
}
