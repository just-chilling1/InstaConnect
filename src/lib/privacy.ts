import { IconLock, IconWorld, IconUsers, type Icon } from "@tabler/icons-react";

export type PostPrivacy = "public" | "followers" | "private";

type PrivacyMeta = {
  value: PostPrivacy;
  label: string;
  Icon: Icon;
};

/** Single source of truth for privacy icon + label, keyed by value and
 *  also exposed as an ordered list for pickers (edit form, create form). */
export const PRIVACY_META: Record<PostPrivacy, PrivacyMeta> = {
  public: { value: "public", label: "Public", Icon: IconWorld },
  followers: { value: "followers", label: "Followers", Icon: IconUsers },
  private: { value: "private", label: "Only you", Icon: IconLock },
};

export const PRIVACY_OPTIONS: PrivacyMeta[] = [
  PRIVACY_META.public,
  PRIVACY_META.followers,
  PRIVACY_META.private,
];

export function privacyMetaFor(value: string): PrivacyMeta {
  return PRIVACY_META[value as PostPrivacy] ?? PRIVACY_META.public;
}
