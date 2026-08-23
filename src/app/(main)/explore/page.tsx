"use client";

import Link from "next/link";
import { IconCompass, IconUserPlus } from "@tabler/icons-react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import FeedSkeleton from "@/components/FeedSkeleton";
import SprocketDivider from "@/components/SprocketDivider";

export default function ExplorePage() {
  const { user } = useProfile();

  const { data: followsData } = db.useQuery(
    user ? { follows: { $: { where: { "follower.id": user.id } }, following: {} } } : null
  );
  const followingIds = new Set(
    (followsData?.follows ?? []).map((f) => f.following?.id).filter(Boolean)
  );

  const { data: profilesData, isLoading } = db.useQuery({
    profiles: {
      $: { order: { createdAt: "desc" }, limit: 24 },
      avatar: {},
      user: {},
    },
  });

  const suggestions = (profilesData?.profiles ?? []).filter(
    (p) => p.user?.id && p.user.id !== user?.id && !followingIds.has(p.user.id)
  );

  const { data: postsData } = db.useQuery({
    posts: {
      $: { where: { archived: false, privacy: "public" }, order: { createdAt: "desc" }, limit: 6 },
      author: { profile: {} },
      image: {},
    },
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-6 flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <IconCompass size={22} className="text-accent" />
        <h1 className="font-display text-xl font-semibold">Explore</h1>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-mono uppercase tracking-wide text-text-faint">
          Suggested people
        </h2>
        {isLoading && <FeedSkeleton />}
        {!isLoading && suggestions.length === 0 && (
          <p className="text-sm text-text-faint">You&apos;re following everyone we know about.</p>
        )}
        <div className="flex flex-col gap-2">
          {suggestions.slice(0, 8).map((profile) => (
            <div
              key={profile.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <Link href={`/profile/${profile.username}`}>
                <Avatar url={profile.avatar?.url} name={profile.displayName} size={44} />
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/profile/${profile.username}`}
                  className="text-sm font-medium text-text hover:underline block truncate"
                >
                  {profile.displayName}
                </Link>
                <p className="text-xs text-text-muted truncate">@{profile.username}</p>
              </div>
              {profile.user?.id && user && (
                <FollowButton targetUserId={profile.user.id} currentUserId={user.id} />
              )}
            </div>
          ))}
        </div>
      </section>

      <SprocketDivider />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-mono uppercase tracking-wide text-text-faint flex items-center gap-1.5">
          <IconUserPlus size={14} /> Popular posts
        </h2>
        <div className="grid grid-cols-3 gap-1">
          {(postsData?.posts ?? []).map((post) => (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="relative aspect-square overflow-hidden rounded-md bg-surface border border-border"
            >
              {post.image?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.image.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="flex items-center justify-center h-full px-2 text-xs text-text-muted text-center line-clamp-3">
                  {post.caption}
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
