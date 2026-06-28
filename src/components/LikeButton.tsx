"use client";

import { useState } from "react";
import { id } from "@instantdb/react";
import { IconHeart, IconHeartFilled } from "@tabler/icons-react";
import db from "@/lib/db";

type LikeButtonProps = {
  postId: string;
  postAuthorId: string;
  currentUserId: string;
  likes: { id: string; user?: { id: string } | null }[];
};

export default function LikeButton({
  postId,
  postAuthorId,
  currentUserId,
  likes,
}: LikeButtonProps) {
  const [busy, setBusy] = useState(false);
  const myLike = likes.find((like) => like.user?.id === currentUserId);
  const count = likes.length;

  async function toggleLike() {
    if (busy) return;
    setBusy(true);
    try {
      if (myLike) {
        await db.transact([db.tx.likes[myLike.id].delete()]);
        return;
      }

      // The like is the critical action: it must succeed on its own. Before
      // this fix, the like and its notification were sent as one atomic
      // transaction -- if postAuthorId was ever missing or malformed,
      // InstantDB rejected the *entire* transaction, so the like silently
      // failed too and the user saw a crash instead of a working like.
      const likeId = id();
      await db.transact([
        db.tx.likes[likeId]
          .update({ createdAt: Date.now() })
          .link({ post: postId, user: currentUserId }),
      ]);

      if (postAuthorId && postAuthorId !== currentUserId) {
        try {
          await db.transact([
            db.tx.notifications[id()]
              .update({ type: "like", read: false, createdAt: Date.now() })
              .link({ recipient: postAuthorId, actor: currentUserId, post: postId }),
          ]);
        } catch (notifyErr) {
          // Best-effort only -- a failed notification should never undo a
          // real like the user just made.
          console.error("Couldn't create like notification:", notifyErr);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggleLike}
      disabled={busy}
      className={`flex items-center gap-1.5 text-sm transition-colors ${
        myLike ? "text-accent" : "text-text-muted hover:text-text"
      }`}
      aria-pressed={Boolean(myLike)}
      aria-label={myLike ? "Unlike" : "Like"}
    >
      {myLike ? <IconHeartFilled size={19} /> : <IconHeart size={19} />}
      <span className="font-mono text-xs">{count}</span>
    </button>
  );
}
