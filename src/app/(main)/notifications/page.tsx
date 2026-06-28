"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  IconBellOff,
  IconHeartFilled,
  IconMessageCircle,
  IconUserPlus,
  IconMessage2,
} from "@tabler/icons-react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import Avatar from "@/components/Avatar";
import FullScreenLoader from "@/components/FullScreenLoader";
import { timeAgo } from "@/lib/format";

const NOTIFICATION_META = {
  like: { Icon: IconHeartFilled, verb: "liked your photo", color: "text-accent" },
  comment: {
    Icon: IconMessageCircle,
    verb: "commented on your photo",
    color: "text-accent-strong",
  },
  follow: { Icon: IconUserPlus, verb: "started following you", color: "text-positive" },
  message: { Icon: IconMessage2, verb: "sent you a message", color: "text-accent" },
} as const;

export default function NotificationsPage() {
  const { user, profile } = useProfile();
  const router = useRouter();

  const { isLoading, data } = db.useQuery(
    user
      ? {
          notifications: {
            $: { where: { "recipient.id": user.id }, order: { createdAt: "desc" } },
            actor: { profile: { avatar: {} } },
            // Needed for "message" notifications so we can navigate to the
            // correct conversation when the notification is clicked.
            conversation: {},
          },
        }
      : null
  );

  const notifications = useMemo(() => data?.notifications ?? [], [data?.notifications]);
  const unread = notifications.filter((n) => !n.read);

  // Clean up duplicate unread follow notifications (pre-existing data hygiene).
  useEffect(() => {
    const seenActor = new Set<string>();
    const toDelete: string[] = [];
    for (const n of notifications) {
      if (n.type !== "follow" || n.read || !n.actor?.id) continue;
      if (seenActor.has(n.actor.id)) {
        toDelete.push(n.id);
      } else {
        seenActor.add(n.actor.id);
      }
    }
    if (toDelete.length === 0) return;
    db.transact(toDelete.map((notifId) => db.tx.notifications[notifId].delete())).catch(
      (err) => console.error("Couldn't clean up duplicate notifications:", err)
    );
  }, [notifications]);

  async function markAllRead() {
    if (unread.length === 0) return;
    await db.transact(unread.map((n) => db.tx.notifications[n.id].update({ read: true })));
  }

  async function handleClick(notification: (typeof notifications)[number]) {
    if (!notification.read) {
      await db.transact([db.tx.notifications[notification.id].update({ read: true })]);
    }

    const type = notification.type as keyof typeof NOTIFICATION_META;

    if (type === "message") {
      // Navigate to the specific conversation if we have the ID, otherwise
      // fall back to the messages index (it will appear at the top of the list).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const convId = (notification as any).conversation?.id;
      router.push(convId ? `/messages?c=${convId}` : "/messages");
    } else if (type === "follow" && notification.actor?.profile?.username) {
      router.push(`/profile/${notification.actor.profile.username}`);
    } else if (profile) {
      router.push(`/profile/${profile.username}`);
    }
  }

  if (isLoading || !user) return <FullScreenLoader />;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Activity</h1>
        {unread.length > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm font-medium text-accent hover:text-accent-strong transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <IconBellOff size={26} className="text-text-faint" />
          <p className="text-text-muted text-sm">
            Nothing yet. Activity on your posts shows up here.
          </p>
        </div>
      )}

      <div className="flex flex-col">
        {notifications.map((notification) => {
          const type = notification.type as keyof typeof NOTIFICATION_META;
          const meta = NOTIFICATION_META[type] ?? NOTIFICATION_META.like;
          const actorProfile = notification.actor?.profile;
          return (
            <button
              key={notification.id}
              onClick={() => handleClick(notification)}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${
                notification.read ? "hover:bg-surface" : "bg-surface hover:bg-surface-2"
              }`}
            >
              <Avatar
                url={actorProfile?.avatar?.url}
                name={actorProfile?.displayName ?? "?"}
                size={40}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium text-text">
                    {actorProfile?.username ?? "Someone"}
                  </span>{" "}
                  <span className="text-text-muted">{meta.verb}</span>
                </p>
                <span className="text-xs font-mono text-text-faint">
                  {timeAgo(notification.createdAt)}
                </span>
              </div>
              <meta.Icon size={18} className={meta.color} />
              {!notification.read && <span className="w-2 h-2 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
