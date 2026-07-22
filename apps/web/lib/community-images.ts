import type { SupabaseClient } from "@supabase/supabase-js";

export async function createCommunityImageUrls(supabase: SupabaseClient, paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data, error } = await supabase.storage.from("community-images").createSignedUrls(paths, 60 * 60);
  if (error) {
    console.error("Failed to create signed community image URLs", error);
    return [];
  }
  return (data ?? []).flatMap((item) => item.signedUrl ? [item.signedUrl] : []);
}
