import { NextResponse } from "next/server";
import { init } from "@instantdb/admin";
import schema from "../../../../../instant.schema";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID;
const ADMIN_TOKEN = process.env.INSTANT_APP_ADMIN_TOKEN;

export async function POST(request: Request) {
  if (!APP_ID || !ADMIN_TOKEN) {
    return NextResponse.json({ error: "Admin API not configured" }, { status: 501 });
  }

  const { userId } = (await request.json()) as { userId?: string };
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const db = init({ appId: APP_ID, adminToken: ADMIN_TOKEN, schema });

  const [
    ownData,
    followsAsFollower,
    followsAsFollowing,
    notificationsReceived,
    notificationsSent,
    blocksMade,
    blocksReceived,
    conversationsData,
  ] = await Promise.all([
    db.query({
      profiles: { $: { where: { "user.id": userId } }, avatar: {} },
      posts: {
        $: { where: { "author.id": userId } },
        image: {},
        likes: {},
        comments: {},
        notifications: {},
      },
      likes: { $: { where: { "user.id": userId } } },
      comments: { $: { where: { "author.id": userId } } },
      bookmarks: { $: { where: { "user.id": userId } } },
      reports: { $: { where: { "reporter.id": userId } } },
    }),
    db.query({ follows: { $: { where: { "follower.id": userId } } } }),
    db.query({ follows: { $: { where: { "following.id": userId } } } }),
    db.query({ notifications: { $: { where: { "recipient.id": userId } } } }),
    db.query({ notifications: { $: { where: { "actor.id": userId } } } }),
    db.query({ blocks: { $: { where: { "blocker.id": userId } } } }),
    db.query({ blocks: { $: { where: { "blocked.id": userId } } } }),
    db.query({
      conversations: {
        $: { where: { "participants.id": userId } },
        messages: {},
        notifications: {},
      },
    }),
  ]);

  const follows = new Map(
    [...(followsAsFollower.follows ?? []), ...(followsAsFollowing.follows ?? [])].map((f) => [
      f.id,
      f,
    ])
  );
  const notifications = new Map(
    [...(notificationsReceived.notifications ?? []), ...(notificationsSent.notifications ?? [])].map(
      (n) => [n.id, n]
    )
  );
  const blocks = new Map(
    [...(blocksMade.blocks ?? []), ...(blocksReceived.blocks ?? [])].map((b) => [b.id, b])
  );

  const txs = [];

  for (const post of ownData.posts ?? []) {
    for (const like of post.likes ?? []) txs.push(db.tx.likes[like.id].delete());
    for (const comment of post.comments ?? []) txs.push(db.tx.comments[comment.id].delete());
    for (const n of post.notifications ?? []) txs.push(db.tx.notifications[n.id].delete());
    if (post.image?.id) txs.push(db.tx.$files[post.image.id].delete());
    txs.push(db.tx.posts[post.id].delete());
  }
  for (const like of ownData.likes ?? []) txs.push(db.tx.likes[like.id].delete());
  for (const comment of ownData.comments ?? []) txs.push(db.tx.comments[comment.id].delete());
  for (const bookmark of ownData.bookmarks ?? []) txs.push(db.tx.bookmarks[bookmark.id].delete());
  for (const report of ownData.reports ?? []) txs.push(db.tx.reports[report.id].delete());
  for (const follow of follows.values()) txs.push(db.tx.follows[follow.id].delete());
  for (const n of notifications.values()) txs.push(db.tx.notifications[n.id].delete());
  for (const block of blocks.values()) txs.push(db.tx.blocks[block.id].delete());

  for (const conversation of conversationsData.conversations ?? []) {
    for (const message of conversation.messages ?? []) {
      txs.push(db.tx.messages[message.id].delete());
    }
    for (const n of conversation.notifications ?? []) {
      txs.push(db.tx.notifications[n.id].delete());
    }
    txs.push(db.tx.conversations[conversation.id].delete());
  }

  const targetProfile = ownData.profiles?.[0];
  if (targetProfile) {
    if (targetProfile.avatar?.id) txs.push(db.tx.$files[targetProfile.avatar.id].delete());
    txs.push(db.tx.profiles[targetProfile.id].delete());
  }

  const BATCH = 100;
  for (let i = 0; i < txs.length; i += BATCH) {
    await db.transact(txs.slice(i, i + BATCH));
  }

  return NextResponse.json({ ok: true });
}
