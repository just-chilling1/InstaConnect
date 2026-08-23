import { NextResponse } from "next/server";
import { id, init } from "@instantdb/admin";
import schema from "../../../../../instant.schema";
import { makePairKey } from "@/lib/makePairKey";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID;
const ADMIN_TOKEN = process.env.INSTANT_APP_ADMIN_TOKEN;

export async function POST(request: Request) {
  if (!APP_ID || !ADMIN_TOKEN) {
    return NextResponse.json({ error: "Admin API not configured" }, { status: 501 });
  }

  const body = (await request.json()) as {
    currentUserId?: string;
    targetUserId?: string;
  };

  const { currentUserId, targetUserId } = body;
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = init({ appId: APP_ID, adminToken: ADMIN_TOKEN, schema });
  const pairKey = makePairKey(currentUserId, targetUserId);

  const existing = await db.query({
    conversations: { $: { where: { pairKey } } },
  });
  if ((existing.conversations?.length ?? 0) > 0) {
    return NextResponse.json({ conversationId: existing.conversations![0].id });
  }

  const graph = await db.query({
    follows: {
      $: {
        where: {
          or: [{ "follower.id": currentUserId }, { "follower.id": targetUserId }],
        },
      },
      follower: {},
      following: {},
    },
    blocks: {
      $: {
        where: {
          or: [{ "blocker.id": currentUserId }, { "blocker.id": targetUserId }],
        },
      },
      blocker: {},
      blocked: {},
    },
  });

  const iFollowThem = (graph.follows ?? []).some(
    (f) => f.follower?.id === currentUserId && f.following?.id === targetUserId
  );
  const theyFollowMe = (graph.follows ?? []).some(
    (f) => f.follower?.id === targetUserId && f.following?.id === currentUserId
  );
  if (!iFollowThem || !theyFollowMe) {
    return NextResponse.json(
      { error: "You can only message people you mutually follow." },
      { status: 403 }
    );
  }

  const isBlocked = (graph.blocks ?? []).some(
    (b) =>
      (b.blocker?.id === currentUserId && b.blocked?.id === targetUserId) ||
      (b.blocker?.id === targetUserId && b.blocked?.id === currentUserId)
  );
  if (isBlocked) {
    return NextResponse.json({ error: "Cannot message this user." }, { status: 403 });
  }

  const convId = id();
  const now = Date.now();
  await db.transact([
    db.tx.conversations[convId]
      .update({ createdAt: now, updatedAt: now, pairKey })
      .link({ participants: [currentUserId, targetUserId] }),
  ]);

  return NextResponse.json({ conversationId: convId });
}
