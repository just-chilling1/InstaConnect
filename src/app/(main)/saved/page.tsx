"use client";

import Link from "next/link";
import { IconBookmark } from "@tabler/icons-react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import PostCard from "@/components/PostCard";
import FullScreenLoader from "@/components/FullScreenLoader";

export default function SavedPage() {
  const { user, isLoading } = useProfile();

  const { data, isLoading: bookmarksLoading } = db.useQuery(
    user
      ? {
          bookmarks: {
            $: { where: { "user.id": user.id }, order: { createdAt: "desc" } },
            post: {
              author: { profile: { avatar: {} } },
              image: {},
              likes: { $: { where: { "user.id": user.id } } },
            },
          },
        }
      : null
  );

  const bookmarks = data?.bookmarks ?? [];
  const posts = bookmarks.map((b) => b.post).filter(Boolean);

  if (isLoading || !user) return <FullScreenLoader />;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <IconBookmark size={22} className="text-accent" />
        <h1 className="font-display text-xl font-semibold">Saved</h1>
      </div>

      {bookmarksLoading && <FullScreenLoader />}

      {!bookmarksLoading && posts.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <IconBookmark size={28} className="text-text-faint" />
          <p className="text-text-muted text-sm">
            Posts you bookmark will show up here. Tap the bookmark icon on any post to save it.
          </p>
          <Link href="/feed" className="text-sm font-medium text-accent hover:text-accent-strong">
            Browse feed
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {posts.map((post) =>
          post ? (
            <PostCard key={post.id} post={post} currentUserId={user.id} />
          ) : null
        )}
      </div>
    </div>
  );
}
