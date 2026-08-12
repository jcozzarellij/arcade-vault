import { createClient } from "@/utils/supabase/client";

export async function getPlayerBest(
  gameId: string,
  name: string
): Promise<{ score: number; rank: number } | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("name, score")
    .eq("game_id", gameId)
    .order("score", { ascending: false });
  if (error || !data) return null;
  const idx = data.findIndex((row) => row.name === name);
  if (idx === -1) return null;
  return { score: data[idx].score, rank: idx + 1 };
}
