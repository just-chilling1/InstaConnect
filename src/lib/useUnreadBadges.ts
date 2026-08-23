import db from "@/lib/db";

/**
 * Shared unread counts for nav badges — one subscription instead of
 * duplicating queries in Sidebar and MobileNav.
 */
export function useUnreadBadges(userId: string | undefined) {
  const { data: notifData } = db.useQuery(
    userId
      ? { notifications: { $: { where: { "recipient.id": userId, read: false } } } }
      : null
  );

  const { data: convData } = db.useQuery(
    userId
      ? { conversations: { $: { where: { "participants.id": userId } } } }
      : null
  );

  const unreadNotifications = notifData?.notifications?.length ?? 0;

  const unreadMessages = (convData?.conversations ?? []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c: any) =>
      c.lastMessageSenderId &&
      c.lastMessageSenderId !== userId &&
      c.lastMessageRead === false
  ).length;

  return { unreadNotifications, unreadMessages };
}
