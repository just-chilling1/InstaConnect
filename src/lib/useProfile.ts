import db from "@/lib/db";

/**
 * Combines auth state with the current user's profile record.
 * `isLoading` stays true until both auth AND the profile query have
 * settled, so callers don't have to juggle two loading flags.
 */
export function useProfile() {
  const { user, isLoading: authLoading, error: authError } = db.useAuth();

  const { data, isLoading: profileLoading } = db.useQuery(
    user
      ? {
          profiles: {
            $: { where: { "user.id": user.id } },
            avatar: {},
          },
        }
      : null
  );

  const profile = data?.profiles?.[0] ?? null;

  return {
    user,
    profile,
    hasProfile: Boolean(profile),
    isLoading: authLoading || (Boolean(user) && profileLoading),
    error: authError,
  };
}
