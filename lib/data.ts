import type { SupabaseClient } from "@supabase/supabase-js";

export type Profile = { id: string; display_name: string | null; target_exam: string; exam_date: string | null };

export async function getProfile(sb: SupabaseClient, userId: string): Promise<Profile> {
  const { data } = await sb.from("profiles").select("*").eq("id", userId).single();
  return (data as Profile) ?? { id: userId, display_name: null, target_exam: "G4", exam_date: null };
}

export const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
export const EXAM_LABEL: Record<string, string> = { G4: "தொகுதி IV", G2: "தொகுதி II / IIA", G1: "தொகுதி I" };
