import { useState } from "react";
import { id } from "@instantdb/react";
import db from "@/lib/db";
import { createOrBumpNotification } from "@/lib/notifications";

type Like = { id: string; user?: { id: string } | null };

type UseLikeToggleArgs = {
  postId: string;
  postAuthorId: string;
  currentUserId: string;
  likes: Like[];
  likeCount?: number;
};

/**
 * Encapsulates the like/unlike transaction + notification side-effect so
 * both the like button and the photo's double-tap gesture can trigger the
 * exact same behavior without duplicating the InstantDB writes.
 */
export function useLikeToggle({
  postId,
  postAuthorId,
  currentUserId,
  likes,
  likeCount: likeCountProp,
}: UseLikeToggleArgs) {
  const [busy, setBusy] = useState(false);
  const myLike = likes.find((like) => like.user?.id === currentUserId);
  const count = likeCountProp ?? likes.length;
  const isLiked = Boolean(myLike);

  async function like() {
    if (busy || myLike) return;
    setBusy(true);
    try {
      const likeId = id();
      await db.transact([
        db.tx.likes[likeId]
          .update({ createdAt: Date.now() })
          .link({ post: postId, user: currentUserId }),
        db.tx.posts[postId].update({ likeCount: count + 1 }),
      ]);

      if (postAuthorId && postAuthorId !== currentUserId) {
        const recipient = await db.queryOnce({
          profiles: { $: { where: { "user.id": postAuthorId } } },
        });
        await createOrBumpNotification({
          type: "like",
          recipientId: postAuthorId,
          actorId: currentUserId,
          postId,
          recipientProfile: recipient.data?.profiles?.[0] ?? null,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function unlike() {
    if (busy || !myLike) return;
    setBusy(true);
    try {
      await db.transact([
        db.tx.likes[myLike.id].delete(),
        db.tx.posts[postId].update({ likeCount: Math.max(0, count - 1) }),
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    if (isLiked) await unlike();
    else await like();
  }

  return { isLiked, count, busy, toggle, like };
}
