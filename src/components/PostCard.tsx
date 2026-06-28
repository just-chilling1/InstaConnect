"use client";

import { useState } from "react";
import Link from "next/link";
import { IconLock, IconWorld, IconUsers, IconMessageCircle } from "@tabler/icons-react";
import Avatar from "@/components/Avatar";
import LikeButton from "@/components/LikeButton";
import CommentList from "@/components/CommentList";
import { timeAgo } from "@/lib/format";

const PRIVACY_META = {
  public: { Icon: IconWorld, label: "Public" },
  followers: { Icon: IconUsers, label: "Followers" },
  private: { Icon: IconLock, label: "Only you" },
} as const;

type PostCardProps = {
  post: {
    id: string;
    caption?: string | null;
    mediaType?: string | null;
    privacy: string;
    createdAt: number;
    author?: {
      id: string;
      profile?: {
        username: string;
        displayName: string;
        avatar?: { url: string } | null;
      } | null;
    } | null;
    image?: { url: string } | null;
    likes: { id: string; user?: { id: string } | null }[];
    comments?: { id: string }[];
  };
  currentUserId: string;
};

export default function PostCard({ post, currentUserId }: PostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const profile = post.author?.profile;
  const privacy = PRIVACY_META[post.privacy as keyof typeof PRIVACY_META] ?? PRIVACY_META.public;
  const commentCount = post.comments?.length ?? 0;
  const isTextOnly = !post.image?.url;
  const isVideo = post.mediaType === "video";

  // If the author's profile genuinely can't be resolved (e.g. it was
  // deleted), don't link anywhere -- a stale /profile/ link is worse than a
  // plain label, and would otherwise dead-end on the "user not found" page.
  const AuthorName = profile?.username ? (
    <Link href={`/profile/${profile.username}`} className="font-medium text-sm text-text hover:underline">
      {profile.username}
    </Link>
  ) : (
    <span className="font-medium text-sm text-text-faint">Unknown user</span>
  );

  const AuthorAvatar = profile?.username ? (
    <Link href={`/profile/${profile.username}`}>
      <Avatar url={profile.avatar?.url} name={profile.displayName ?? "?"} size={36} />
    </Link>
  ) : (
    <Avatar url={null} name="?" size={36} />
  );

  return (
    <article className="border border-border bg-surface rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        {AuthorAvatar}
        <div className="flex-1 min-w-0">
          {AuthorName}
          <div className="flex items-center gap-1.5 text-xs font-mono text-text-faint">
            <span>{timeAgo(post.createdAt)}</span>
            <span aria-hidden="true">·</span>
            <privacy.Icon size={12} aria-hidden="true" />
            <span>{privacy.label}</span>
          </div>
        </div>
      </div>

      {!isTextOnly && post.image?.url && (
        isVideo ? (
          <video
            src={post.image.url}
            controls
            className="w-full max-h-[600px] bg-ink"
            aria-label={post.caption || "Post video"}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image.url}
            alt={post.caption || "Post photo"}
            className="w-full object-cover"
          />
        )
      )}

      <div className="px-4 py-3 flex flex-col gap-2">
        {isTextOnly && post.caption && (
          <p className="text-base leading-snug py-2">{post.caption}</p>
        )}

        <div className="flex items-center gap-4">
          <LikeButton
            postId={post.id}
            postAuthorId={post.author?.id ?? ""}
            currentUserId={currentUserId}
            likes={post.likes}
          />
          <button
            onClick={() => setCommentsOpen((open) => !open)}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
            aria-expanded={commentsOpen}
          >
            <IconMessageCircle size={19} />
            <span className="font-mono text-xs">{commentCount}</span>
          </button>
        </div>

        {!isTextOnly && post.caption && (
          <p className="text-sm leading-snug">
            <span className="mr-1.5">{AuthorName}</span>
            <span className="text-text-muted">{post.caption}</span>
          </p>
        )}

        {commentsOpen && (
          <CommentList
            postId={post.id}
            postAuthorId={post.author?.id ?? ""}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </article>
  );
}
