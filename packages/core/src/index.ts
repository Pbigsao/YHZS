export type Role = "member" | "reviewer" | "admin";
export type ContentStatus = "pending" | "approved" | "rejected" | "hidden" | "removed";
export type ActivityStatus = "draft" | "published" | "closed" | "archived";

export interface Board {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
}

export interface ActivityVoteSettings {
  voteLimit: number;
  allowVoteChange: boolean;
}

export const IMAGE_RULES = {
  maxBytes: 5 * 1024 * 1024,
  maxPostImages: 5,
  maxSubmissionImages: 10,
  acceptedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"]
} as const;

export function validateImage(file: Pick<File, "size" | "type">): string | null {
  if (!IMAGE_RULES.acceptedTypes.includes(file.type as (typeof IMAGE_RULES.acceptedTypes)[number])) {
    return "Only JPEG, PNG, WebP, and GIF images are accepted.";
  }
  if (file.size > IMAGE_RULES.maxBytes) return "Images must be 5 MB or smaller.";
  return null;
}
