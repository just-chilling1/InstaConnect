import { z } from "zod";

export const PRIVACY_VALUES = ["public", "followers", "private"] as const;
export type PrivacyValue = (typeof PRIVACY_VALUES)[number];

export const MAX_CAPTION_LENGTH = 2200;

/**
 * A post must contain at least a caption OR an attached photo/video.
 * `hasMedia` is set from component state (whether a file is selected) and
 * synced into the form via `setValue` so Zod can validate the combination.
 */
export const createPostSchema = z
  .object({
    caption: z.string().trim().max(MAX_CAPTION_LENGTH, "Keep it under 2,200 characters.").optional(),
    privacy: z.enum(PRIVACY_VALUES),
    hasMedia: z.boolean(),
  })
  .refine((data) => Boolean(data.caption && data.caption.length > 0) || data.hasMedia, {
    message: "Write something, or attach a photo or video.",
    path: ["caption"],
  });

export type CreatePostValues = z.infer<typeof createPostSchema>;
