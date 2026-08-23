"use client";

import { IconHeart, IconHeartFilled } from "@tabler/icons-react";
import { useLikeToggle } from "@/lib/useLikeToggle";

type LikeButtonProps = {
  postId: string;
  postAuthorId: string;
  currentUserId: string;
  likes: { id: string; user?: { id: string } | null }[];
  likeCount?: number;
};

export default function LikeButton({
  postId,
  postAuthorId,
  currentUserId,
  likes,
  likeCount,
}: LikeButtonProps) {
  const { isLiked, count, busy, toggle } = useLikeToggle({
    postId,
    postAuthorId,
    currentUserId,
    likes,
    likeCount,
  });

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex items-center gap-1.5 text-sm transition-all duration-150 active:scale-90 ${
        isLiked ? "text-accent" : "text-text-muted hover:text-text"
      }`}
      aria-pressed={isLiked}
      aria-label={isLiked ? "Unlike" : "Like"}
    >
      {isLiked ? (
        <IconHeartFilled size={19} className="animate-[heart-pop_0.35s_ease-out]" />
      ) : (
        <IconHeart size={19} />
      )}
      <span className="font-mono text-xs sr-only">{count}</span>
    </button>
  );
}
