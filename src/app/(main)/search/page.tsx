"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import Avatar from "@/components/Avatar";
import FullScreenLoader from "@/components/FullScreenLoader";

const DEBOUNCE_MS = 300;

function SearchContent() {
  const { user } = useProfile();
  const searchParams = useSearchParams();
  const initial = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [debounced, setDebounced] = useState(initial);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const { data: userData, isLoading: usersLoading } = db.useQuery(
    debounced
      ? {
          profiles: {
            $: {
              where: {
                or: [
                  { username: { $ilike: `%${debounced}%` } },
                  { displayName: { $ilike: `%${debounced}%` } },
                ],
              },
              limit: 12,
            },
            avatar: {},
            user: {},
          },
        }
      : null
  );

  const { data: postData, isLoading: postsLoading } = db.useQuery(
    debounced
      ? {
          posts: {
            $: {
              where: {
                archived: false,
                caption: { $like: `%${debounced}%` },
              },
              order: { createdAt: "desc" },
              limit: 12,
            },
            author: { profile: {} },
            image: {},
          },
        }
      : null
  );

  const users = (userData?.profiles ?? []).filter((p) => p.user?.id !== user?.id);
  const posts = postData?.posts ?? [];
  const loading = usersLoading || postsLoading;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <IconSearch size={22} className="text-accent" />
        <h1 className="font-display text-xl font-semibold">Search</h1>
      </div>

      <div className="flex items-center gap-2 bg-ink border border-border rounded-lg px-3 py-2 focus-within:border-accent transition-colors">
        <IconSearch size={16} className="text-text-faint flex-shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people or posts..."
          className="flex-1 min-w-0 bg-transparent text-sm text-text placeholder:text-text-faint outline-none"
          autoFocus
        />
      </div>

      {!debounced && (
        <p className="text-sm text-text-faint text-center py-10">
          Type to search usernames, display names, or post captions.
        </p>
      )}

      {debounced && loading && <p className="text-sm text-text-faint text-center">Searching...</p>}

      {debounced && !loading && users.length === 0 && posts.length === 0 && (
        <p className="text-sm text-text-faint text-center py-10">No results for &ldquo;{debounced}&rdquo;.</p>
      )}

      {users.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-mono uppercase tracking-wide text-text-faint">People</h2>
          {users.map((profile) => (
            <Link
              key={profile.id}
              href={`/profile/${profile.username}`}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-2 transition-colors"
            >
              <Avatar url={profile.avatar?.url} name={profile.displayName} size={36} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text truncate">{profile.displayName}</p>
                <p className="text-xs text-text-muted truncate">@{profile.username}</p>
              </div>
            </Link>
          ))}
        </section>
      )}

      {posts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-mono uppercase tracking-wide text-text-faint">Posts</h2>
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-surface-2 transition-colors"
            >
              {post.image?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.image.url}
                  alt=""
                  className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-md bg-surface-2 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm text-text truncate">
                  {post.caption ?? "Untitled post"}
                </p>
                <p className="text-xs text-text-muted truncate">
                  @{post.author?.profile?.username ?? "unknown"}
                </p>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <SearchContent />
    </Suspense>
  );
}
