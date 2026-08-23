import { id } from "@instantdb/react";
import db from "@/lib/db";

type NotificationType = "like" | "comment" | "follow" | "message";

type CreateNotificationArgs = {
  type: NotificationType;
  recipientId: string;
  actorId: string;
  postId?: string;
  conversationId?: string;
  /** Skip if recipient has muted this notification type */
  recipientProfile?: {
    muteLikeNotifications?: boolean | null;
    muteCommentNotifications?: boolean | null;
    muteFollowNotifications?: boolean | null;
    muteMessageNotifications?: boolean | null;
  } | null;
};

function isMuted(type: NotificationType, profile: CreateNotificationArgs["recipientProfile"]) {
  if (!profile) return false;
  switch (type) {
    case "like":
      return Boolean(profile.muteLikeNotifications);
    case "comment":
      return Boolean(profile.muteCommentNotifications);
    case "follow":
      return Boolean(profile.muteFollowNotifications);
    case "message":
      return Boolean(profile.muteMessageNotifications);
    default:
      return false;
  }
}

/**
 * Creates or bumps an unread notification, deduplicating spam for
 * like / follow / message types.
 */
export async function createOrBumpNotification({
  type,
  recipientId,
  actorId,
  postId,
  conversationId,
  recipientProfile,
}: CreateNotificationArgs) {
  if (recipientId === actorId || isMuted(type, recipientProfile)) return;

  const now = Date.now();

  try {
    const existing = await db.queryOnce({
      notifications: {
        $: {
          where: {
            type,
            read: false,
            "recipient.id": recipientId,
            "actor.id": actorId,
            ...(postId ? { "post.id": postId } : {}),
            ...(conversationId ? { "conversation.id": conversationId } : {}),
          },
        },
      },
    });
    const list = existing.data?.notifications ?? [];

    if (list.length > 0) {
      const [survivor, ...duplicates] = list;
      await db.transact([
        db.tx.notifications[survivor.id].update({ createdAt: now, read: false }),
        ...duplicates.map((n) => db.tx.notifications[n.id].delete()),
      ]);
      return;
    }

    const notifId = id();
    await db.transact([
      db.tx.notifications[notifId]
        .update({ type, read: false, createdAt: now })
        .link({
          recipient: recipientId,
          actor: actorId,
          ...(postId ? { post: postId } : {}),
          ...(conversationId ? { conversation: conversationId } : {}),
        }),
    ]);
  } catch (err) {
    console.error("Notification error:", err);
  }
}
