"use client";

import { useMemo, useState } from "react";
import { id } from "@instantdb/react";
import { IconBookmark, IconBookmarkFilled } from "@tabler/icons-react";
import db from "@/lib/db";

type BookmarkButtonProps = {
  postId: string;
  currentUserId: string;
};

export default function BookmarkButton({ postId, currentUserId }: BookmarkButtonProps) {
  const [busy, setBusy] = useState(false);

  const { data } = db.useQuery({
    bookmarks: {
      $: { where: { "user.id": currentUserId, "post.id": postId } },
    },
  });

  const bookmark = useMemo(() => data?.bookmarks?.[0] ?? null, [data?.bookmarks]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (bookmark) {
        await db.transact([db.tx.bookmarks[bookmark.id].delete()]);
      } else {
        await db.transact([
          db.tx.bookmarks[id()]
            .update({ createdAt: Date.now() })
            .link({ user: currentUserId, post: postId }),
        ]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex items-center gap-1.5 text-sm transition-colors ${
        bookmark ? "text-accent" : "text-text-muted hover:text-text"
      }`}
      aria-pressed={Boolean(bookmark)}
      aria-label={bookmark ? "Remove bookmark" : "Save post"}
    >
      {bookmark ? <IconBookmarkFilled size={19} /> : <IconBookmark size={19} />}
    </button>
  );
}
