import type { SupabaseClient } from "@supabase/supabase-js";

type CreateImageRecord = (storagePath: string, position: number) => PromiseLike<{ error: { message: string } | null }>;

export type ImageUploadFailure = {
  fileName: string;
  message: string;
};

type UploadCommunityImagesOptions = {
  supabase: SupabaseClient;
  userId: string;
  scope: "posts" | "submissions";
  parentId: string;
  files: File[];
  createImageRecord: CreateImageRecord;
};

export async function uploadCommunityImages({
  supabase,
  userId,
  scope,
  parentId,
  files,
  createImageRecord,
}: UploadCommunityImagesOptions): Promise<ImageUploadFailure[]> {
  const results = await Promise.all(
    files.map(async (file, position): Promise<ImageUploadFailure | null> => {
      const storagePath = `${userId}/${scope}/${parentId}/${crypto.randomUUID()}`;
      let uploaded = false;
      let persisted = false;

      try {
        const { error: uploadError } = await supabase.storage
          .from("community-images")
          .upload(storagePath, file);

        if (uploadError) {
          return { fileName: file.name, message: uploadError.message };
        }
        uploaded = true;

        const { error: recordError } = await createImageRecord(storagePath, position);
        if (!recordError) {
          persisted = true;
          return null;
        }

        return { fileName: file.name, message: recordError.message };
      } catch (error) {
        return {
          fileName: file.name,
          message: error instanceof Error ? error.message : "Unknown upload error",
        };
      } finally {
        if (uploaded && !persisted) {
          try {
            const { error: cleanupError } = await supabase.storage
              .from("community-images")
              .remove([storagePath]);
            if (cleanupError) {
              console.error("Failed to remove an orphaned community image", cleanupError);
            }
          } catch (cleanupError) {
            console.error("Failed to remove an orphaned community image", cleanupError);
          }
        }
      }
    })
  );

  return results.filter((result): result is ImageUploadFailure => result !== null);
}

export function formatImageUploadFailures(failures: ImageUploadFailure[]): string {
  return `图片上传失败：${failures.map(({ fileName, message }) => `${fileName}（${message}）`).join("；")}`;
}
