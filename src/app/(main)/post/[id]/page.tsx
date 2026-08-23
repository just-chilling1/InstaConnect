"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import PostCard from "@/components/PostCard";
import FullScreenLoader from "@/components/FullScreenLoader";
import UserNotFound from "@/components/UserNotFound";
import { useParams, useRouter } from "next/navigation";

export default function PostPage() {
  const { id: postId } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useProfile();
  const router = useRouter();

  const { isLoading, data } = db.useQuery(
    postId
      ? {
          posts: {
            $: { where: { id: postId } },
            author: { profile: { avatar: {} } },
            image: {},
            likes: {
              $: user ? { where: { "user.id": user.id } } : undefined,
            },
          },
        }
      : null
  );

  const post = data?.posts?.[0];

  if (authLoading || isLoading || !user) return <FullScreenLoader />;
  if (!post) return <UserNotFound username="post" />;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 flex flex-col gap-4">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text transition-colors w-fit"
      >
        <IconArrowLeft size={16} />
        Back
      </button>
      <PostCard post={post} currentUserId={user.id} showPermalink={false} />
    </div>
  );
}
