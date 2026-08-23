"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { IconMessageCircle, IconHeartFilled } from "@tabler/icons-react";
import Avatar from "@/components/Avatar";
import LikeButton from "@/components/LikeButton";
import CommentList from "@/components/CommentList";
import BookmarkButton from "@/components/BookmarkButton";
import ReportButton from "@/components/ReportButton";
import LikedByModal from "@/components/LikedByModal";
import OptimizedImage from "@/components/OptimizedImage";
import { timeAgo } from "@/lib/format";
import { privacyMetaFor } from "@/lib/privacy";
import { useLikeToggle } from "@/lib/useLikeToggle";

const DOUBLE_TAP_WINDOW_MS = 320;

type PostCardProps = {
  post: {
    id: string;
    caption?: string | null;
    mediaType?: string | null;
    privacy: string;
    createdAt: number;
    likeCount?: number | null;
    commentCount?: number | null;
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
  /** Hide permalink link in header (e.g. on dedicated post page) */
  showPermalink?: boolean;
};

export default function PostCard({
  post,
  currentUserId,
  showPermalink = true,
}: PostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likedByOpen, setLikedByOpen] = useState(false);
  const [burstKey, setBurstKey] = useState<number | null>(null);
  const lastTapRef = useRef(0);

  const profile = post.author?.profile;
  const privacy = privacyMetaFor(post.privacy);
  const commentCount = post.commentCount ?? post.comments?.length ?? 0;
  const isTextOnly = !post.image?.url;
  const isVideo = post.mediaType === "video";

  // Shared with LikeButton below so a double-tap on the photo and a click on
  // the heart icon both go through the exact same InstantDB transaction.
  const { isLiked, count: likeCount, like } = useLikeToggle({
    postId: post.id,
    postAuthorId: post.author?.id ?? "",
    currentUserId,
    likes: post.likes,
    likeCount: post.likeCount ?? undefined,
  });

  // Classic double-tap-to-like: the photo itself has no single-tap action
  // (navigation to the post lives on the timestamp instead), which is what
  // lets a quick second tap register unambiguously as "like this" rather
  // than racing a click-driven navigation.
  function handlePhotoTap() {
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < DOUBLE_TAP_WINDOW_MS;
    lastTapRef.current = now;
    if (!isDoubleTap) return;

    if (!isLiked) like();
    setBurstKey(now);
  }

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
    <article className="frame-card border border-border bg-surface rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        {AuthorAvatar}
        <div className="flex-1 min-w-0">
          {AuthorName}
          <div className="flex items-center gap-1.5 text-xs font-mono text-text-faint">
            {showPermalink ? (
              <Link href={`/post/${post.id}`} className="hover:text-text transition-colors">
                {timeAgo(post.createdAt)}
              </Link>
            ) : (
              <span>{timeAgo(post.createdAt)}</span>
            )}
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
          <div
            onClick={handlePhotoTap}
            className="frame-corners relative w-full aspect-[4/5] max-h-[600px] bg-ink overflow-hidden cursor-pointer select-none"
            role="button"
            tabIndex={-1}
            aria-label="Photo -- double-tap to like"
          >
            <OptimizedImage
              src={post.image.url}
              alt={post.caption || "Post photo"}
              fill
              className="object-cover"
            />
            {burstKey !== null && (
              <span
                key={burstKey}
                onAnimationEnd={() => setBurstKey(null)}
                className="heart-burst absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <IconHeartFilled size={92} className="text-white" />
              </span>
            )}
          </div>
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
            likeCount={likeCount}
          />
          {likeCount > 0 && (
            <button
              onClick={() => setLikedByOpen(true)}
              className="text-xs font-mono text-text-faint hover:text-text transition-colors"
            >
              {likeCount} {likeCount === 1 ? "like" : "likes"}
            </button>
          )}
          <button
            onClick={() => setCommentsOpen((open) => !open)}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
            aria-expanded={commentsOpen}
          >
            <IconMessageCircle size={19} />
            <span className="font-mono text-xs">{commentCount}</span>
          </button>
          <BookmarkButton postId={post.id} currentUserId={currentUserId} />
          <ReportButton
            type="post"
            postId={post.id}
            currentUserId={currentUserId}
            className="ml-auto"
          />
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

      {likedByOpen && <LikedByModal postId={post.id} onClose={() => setLikedByOpen(false)} />}
    </article>
  );
}
