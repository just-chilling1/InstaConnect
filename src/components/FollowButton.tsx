"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { id, lookup } from "@instantdb/react";
import db from "@/lib/db";

type FollowButtonProps = {
  targetUserId: string;
  currentUserId: string;
};

export default function FollowButton({ targetUserId, currentUserId }: FollowButtonProps) {
  const [busy, setBusy] = useState(false);
  // Optimistic state: the follow status we want to show immediately after a
  // click, before the server round-trip completes. We show this value while
  // `busy` is true, and switch back to the server value once the live query
  // has caught up (i.e. serverIsFollowing matches optimisticFollowing).
  // This prevents the button from briefly flickering back to its old label
  // between the write completing and the subscription reflecting it.
  const [optimisticFollowing, setOptimisticFollowing] = useState(false);
  // A ref-based lock closes a real race that `busy` state alone can't: two
  // toggleFollow() calls fired in the same tick (e.g. a very fast
  // double-click) both read the *same* pre-update `busy` value, since
  // setBusy(true) doesn't apply until the next render. Refs update
  // synchronously, so this can't be bypassed that way.
  const lockRef = useRef(false);

  // A deterministic, order-sensitive key for this (follower, following)
  // pair. `instant.schema.ts` marks `follows.pairKey` as `.unique()`, so
  // this is what actually makes a duplicate follow *impossible* at the
  // database level, not just unlikely: InstantDB itself will never let two
  // `follows` records carry the same `pairKey` value.
  const pairKey = `${currentUserId}_${targetUserId}`;

  const followQuery = {
    follows: {
      $: { where: { "follower.id": currentUserId, "following.id": targetUserId } },
    },
  };

  const { data } = db.useQuery(followQuery);

  const matches = useMemo(() => data?.follows ?? [], [data?.follows]);
  const serverIsFollowing = matches.length > 0;

  // While busy, show the optimistic value. Once the live query has caught
  // up to the expected state, drop out of busy mode so the server is the
  // source of truth again. This prevents the flash where setBusy(false)
  // fires before the subscription has reflected the write.
  useEffect(() => {
    if (busy && serverIsFollowing === optimisticFollowing) {
      lockRef.current = false;
      setBusy(false);
    }
  }, [busy, serverIsFollowing, optimisticFollowing]);

  const isFollowing = busy ? optimisticFollowing : serverIsFollowing;

  // Self-healing for data that predates this fix: collapse any leftover
  // duplicates down to one record, and backfill `pairKey` onto whichever
  // one survives so the unique constraint covers it going forward too.
  useEffect(() => {
    if (matches.length === 0) return;
    const [survivor, ...duplicates] = matches;
    const deletions = duplicates.map((m) => db.tx.follows[m.id].delete());
    const backfill =
      survivor.pairKey !== pairKey ? [db.tx.follows[survivor.id].update({ pairKey })] : [];
    const ops = [...deletions, ...backfill];
    if (ops.length === 0) return;
    db.transact(ops).catch((err) =>
      console.error("Couldn't clean up/backfill follow records:", err)
    );
  }, [matches, pairKey]);

  if (targetUserId === currentUserId) return null;

  async function toggleFollow() {
    if (lockRef.current) return;
    lockRef.current = true;

    const wasFollowing = isFollowing;
    // Flip the button immediately. Combined with `disabled={busy}` below,
    // the button is unmistakably in its new state and cannot be clicked
    // again until this finishes -- which is what guarantees the counter
    // only ever moves by exactly one per click.
    setOptimisticFollowing(!wasFollowing);
    setBusy(true);

    try {
      if (wasFollowing) {
        // Re-check fresh and delete every matching record, not just one --
        // self-healing if a legacy duplicate is still hanging around for
        // this pair.
        const fresh = await db.queryOnce(followQuery);
        if (fresh.data.follows.length > 0) {
          await db.transact(fresh.data.follows.map((m) => db.tx.follows[m.id].delete()));
        }
        return;
      }

      // Upsert keyed on the unique `pairKey` attribute instead of a fresh
      // random id: if a record for this exact pair already exists --
      // created moments ago from another tab, a retried request, anything
      // -- this updates *that* record instead of creating a second one.
      // Two simultaneous follow clicks for the same pair can now only ever
      // converge on a single row; the database enforces it, not just this
      // component.
      // Note: `lookup("pairKey", pairKey)` already establishes pairKey's
      // value on the resulting entity -- whether it creates a new one or
      // matches an existing one. Passing `pairKey` again inside `.update()`
      // is what triggers InstantDB's "Validation failed for lookup:
      // Updates with lookups can only update the lookup attribute if an
      // entity with the unique attribute value already exists" error on
      // the create path, since at that point the entity doesn't exist yet.
      await db.transact([
        db.tx.follows[lookup("pairKey", pairKey)]
          .update({ createdAt: Date.now() })
          .link({ follower: currentUserId, following: targetUserId }),
      ]);

      try {
        // Root cause of the repeated "X started following you" spam: this
        // used to unconditionally create a brand new notification every
        // time this branch ran -- including every time someone unfollowed
        // and re-followed within seconds. The follow *relationship* itself
        // is protected by the unique `pairKey` above, but a notification
        // has no such constraint, so nothing stopped a dozen of them
        // piling up from rapid toggling.
        //
        // A permanent database-level uniqueness constraint isn't the right
        // tool here though: unlike the follow relationship (which really
        // should only ever have one row, period), it's normal and expected
        // for someone to get a *fresh* "started following you" notification
        // if they unfollow and are re-followed later, once they've already
        // seen the first one. So the rule that actually matches real
        // product behavior is conditional -- "don't add another while an
        // unread one from this same person already exists" -- which is
        // exactly what this checks before creating.
        const existingNotif = await db.queryOnce({
          notifications: {
            $: {
              where: {
                type: "follow",
                read: false,
                "recipient.id": targetUserId,
                "actor.id": currentUserId,
              },
            },
          },
        });

        if (existingNotif.data.notifications.length > 0) {
          // Already an unread one waiting -- bump it to now instead of
          // adding a second, and collapse any pre-existing duplicates from
          // before this fix down to that single survivor.
          const [survivor, ...duplicates] = existingNotif.data.notifications;
          await db.transact([
            db.tx.notifications[survivor.id].update({ createdAt: Date.now() }),
            ...duplicates.map((n) => db.tx.notifications[n.id].delete()),
          ]);
        } else {
          await db.transact([
            db.tx.notifications[id()]
              .update({ type: "follow", read: false, createdAt: Date.now() })
              .link({ recipient: targetUserId, actor: currentUserId }),
          ]);
        }
      } catch (notifyErr) {
        console.error("Couldn't create follow notification:", notifyErr);
      }
    } catch (err) {
      // The write failed -- roll back the optimistic state and clear busy
      // immediately so the button snaps back to the real server value.
      console.error("Couldn't update follow state:", err);
      lockRef.current = false;
      setBusy(false);
    }
    // On success we do NOT clear busy here. The useEffect above watches for
    // serverIsFollowing to match optimisticFollowing and clears busy at that
    // point. This prevents the button from flickering back to its old label
    // in the gap between the write completing and the live subscription
    // reflecting the change.
  }

  return (
    <button
      onClick={toggleFollow}
      disabled={busy}
      aria-busy={busy}
      className={`text-sm font-medium px-3.5 py-1.5 rounded-lg border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        isFollowing
          ? "border-border text-text-muted hover:border-negative hover:text-negative"
          : "border-accent bg-accent text-accent-text hover:bg-accent-strong"
      }`}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
