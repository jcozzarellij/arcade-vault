import { useSyncExternalStore } from "react";
import { createClient } from "@/utils/supabase/client";

export type StoredUser = { name: string } | null;

export type SavedScore = { game: string; score: number; name: string };

const USER_KEY = "av_user";
const USER_CHANGED_EVENT = "av-user-changed";

export function getStoredUser(): StoredUser {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser): void {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
  window.dispatchEvent(new Event(USER_CHANGED_EVENT));
}

export function clearStoredUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(USER_CHANGED_EVENT));
}

export function onUserChange(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(USER_CHANGED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(USER_CHANGED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

let cachedRaw: string | null = null;
let cachedUser: StoredUser = null;

function getUserSnapshot(): StoredUser {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedUser = raw ? JSON.parse(raw) : null;
    } catch {
      cachedUser = null;
    }
  }
  return cachedUser;
}

const getServerSnapshot = () => null;

export function useStoredUser(): StoredUser {
  return useSyncExternalStore(onUserChange, getUserSnapshot, getServerSnapshot);
}

export async function saveScore(
  entry: SavedScore
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("scores").insert({
    game_id: entry.game,
    name: entry.name,
    score: entry.score,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
