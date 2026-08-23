import { id } from "@instantdb/react";
import db from "@/lib/db";
import { makePairKey } from "@/lib/makePairKey";

/**
 * Opens or creates a 1:1 conversation between two mutual followers.
 * Validates block status and mutual follow before creating.
 */
export async function openConversation(
  currentUserId: string,
  targetUserId: string
): Promise<string | null> {
  if (currentUserId === targetUserId) return null;

  const pairKey = makePairKey(currentUserId, targetUserId);

  const existing = await db.queryOnce({
    conversations: { $: { where: { pairKey } } },
  });
  if ((existing.data?.conversations?.length ?? 0) > 0) {
    return existing.data!.conversations[0].id;
  }

  // Validate mutual follow + no blocks via API when available, else client-side.
  try {
    const res = await fetch("/api/conversations/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId, currentUserId }),
    });
    if (res.ok) {
      const { conversationId } = (await res.json()) as { conversationId: string };
      return conversationId;
    }
    if (res.status !== 501) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Cannot start conversation");
    }
  } catch (err) {
    if (err instanceof Error && err.message !== "Cannot start conversation") {
      // Network error — fall through to client validation
    } else {
      throw err;
    }
  }

  // Client-side fallback when admin API is not configured.
  const { data } = await db.queryOnce({
    follows: {
      $: {
        where: {
          or: [
            { "follower.id": currentUserId },
            { "follower.id": targetUserId },
          ],
        },
      },
      follower: {},
      following: {},
    },
    blocks: {
      $: {
        where: {
          or: [
            { "blocker.id": currentUserId },
            { "blocker.id": targetUserId },
          ],
        },
      },
      blocker: {},
      blocked: {},
    },
  });

  const iFollowThem = (data.follows ?? []).some(
    (f) => f.follower?.id === currentUserId && f.following?.id === targetUserId
  );
  const theyFollowMe = (data.follows ?? []).some(
    (f) => f.follower?.id === targetUserId && f.following?.id === currentUserId
  );
  if (!iFollowThem || !theyFollowMe) {
    throw new Error("You can only message people you mutually follow.");
  }

  const isBlocked = (data.blocks ?? []).some(
    (b) =>
      (b.blocker?.id === currentUserId && b.blocked?.id === targetUserId) ||
      (b.blocker?.id === targetUserId && b.blocked?.id === currentUserId)
  );
  if (isBlocked) {
    throw new Error("Cannot message this user.");
  }

  const convId = id();
  const now = Date.now();
  await db.transact([
    db.tx.conversations[convId]
      .update({ createdAt: now, updatedAt: now, pairKey })
      .link({ participants: [currentUserId, targetUserId] }),
  ]);
  return convId;
}
