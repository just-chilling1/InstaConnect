"use client";

import Link from "next/link";
import db from "@/lib/db";
import Avatar from "@/components/Avatar";
import FullScreenLoader from "@/components/FullScreenLoader";

type LikedByModalProps = {
  postId: string;
  onClose: () => void;
};

export default function LikedByModal({ postId, onClose }: LikedByModalProps) {
  const { data, isLoading } = db.useQuery({
    likes: {
      $: { where: { "post.id": postId } },
      user: { profile: { avatar: {} } },
    },
  });

  const likes = data?.likes ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Liked by"
    >
      <div
        className="w-full max-w-sm max-h-[70vh] flex flex-col rounded-xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-display font-semibold text-text">Liked by</h2>
          <button
            onClick={onClose}
            className="text-sm text-text-muted hover:text-text transition-colors"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && <FullScreenLoader />}
          {!isLoading && likes.length === 0 && (
            <p className="px-4 py-6 text-sm text-text-faint text-center">No likes yet.</p>
          )}
          {likes.map((like) => {
            const profile = like.user?.profile;
            if (!profile?.username) return null;
            return (
              <Link
                key={like.id}
                href={`/profile/${profile.username}`}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors"
              >
                <Avatar url={profile.avatar?.url} name={profile.displayName} size={36} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text truncate">{profile.displayName}</p>
                  <p className="text-xs text-text-muted truncate">@{profile.username}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
