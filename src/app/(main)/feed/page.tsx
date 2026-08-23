"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconCamera, IconUsers, IconSquarePlus } from "@tabler/icons-react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import PostCard from "@/components/PostCard";
import FeedSkeleton from "@/components/FeedSkeleton";
import SprocketDivider from "@/components/SprocketDivider";

const PAGE_SIZE = 12;

type FeedFilter = "all" | "following";

const FILTERS: { value: FeedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "following", label: "Following" },
];

export default function FeedPage() {
  const { user } = useProfile();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data: followsData, isLoading: followsLoading } = db.useQuery(
    user ? { follows: { $: { where: { "follower.id": user.id } }, following: {} } } : null
  );
  const followingIds = (followsData?.follows ?? [])
    .map((f) => f.following?.id)
    .filter((v): v is string => Boolean(v));

  const readyToQueryPosts = filter === "all" || !followsLoading;

  const { isLoading, data } = db.useQuery(
    user && readyToQueryPosts
      ? {
          posts: {
            $: {
              where: {
                archived: false,
                ...(filter === "following" ? { "author.id": { $in: followingIds } } : {}),
              },
              order: { createdAt: "desc" },
              limit,
            },
            author: { profile: { avatar: {} } },
            image: {},
            likes: {
              $: { where: { "user.id": user.id } },
            },
          },
          blocks: {
            $: { where: { "blocker.id": user.id } },
            blocked: {},
          },
        }
      : null
  );

  const blockedIds = new Set((data?.blocks ?? []).map((b) => b.blocked?.id).filter(Boolean));
  const posts = (data?.posts ?? []).filter((post) => !blockedIds.has(post.author?.id));

  const loading = isLoading || (filter === "following" && followsLoading);
  const followingEmpty = filter === "following" && !followsLoading && followingIds.length === 0;
  const hasMore = posts.length >= limit;

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    setLimit((l) => l + PAGE_SIZE);
  }, [hasMore, loading]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="mx-auto max-w-xl px-4 py-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold tracking-tight">Feed</h1>
        <Link
          href="/create"
          className="flex items-center gap-1.5 text-sm font-medium border border-accent text-accent rounded-lg px-3.5 py-1.5 hover:bg-accent hover:text-accent-text hover:border-accent-strong active:scale-[0.97] transition-all"
        >
          <IconSquarePlus size={16} />
          New post
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Feed filter"
        className="inline-flex self-start gap-0.5 rounded-lg border border-border bg-surface-2 p-1"
      >
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => {
              setFilter(f.value);
              setLimit(PAGE_SIZE);
            }}
            className={`text-sm font-medium rounded-md px-3.5 py-1.5 transition-colors ${
              filter === f.value
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <SprocketDivider />

      {loading && posts.length === 0 && <FeedSkeleton />}

      {!loading && followingEmpty && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <IconUsers size={28} className="text-text-faint" />
          <p className="text-text-muted text-sm">
            You&apos;re not following anyone yet. Visit a profile and tap Follow to see their
            posts here.
          </p>
        </div>
      )}

      {!loading && !followingEmpty && posts.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <IconCamera size={28} className="text-text-faint" />
          <p className="text-text-muted text-sm">
            Nothing here yet. Follow people or share your first photo.
          </p>
          <Link
            href="/create"
            className="text-sm font-medium text-accent hover:text-accent-strong transition-colors"
          >
            Create a post
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} currentUserId={user!.id} />
        ))}
      </div>

      {hasMore && <div ref={loadMoreRef} className="h-8" aria-hidden="true" />}
      {loading && posts.length > 0 && (
        <p className="text-text-faint text-sm text-center py-2">Loading more...</p>
      )}
    </div>
  );
}
