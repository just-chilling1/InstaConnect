"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { id } from "@instantdb/react";
import { IconLock, IconWorld, IconUsers } from "@tabler/icons-react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import UploadDropzone from "@/components/UploadDropzone";
import { createPostSchema, type CreatePostValues, type PrivacyValue } from "@/lib/validation";

const PRIVACY_OPTIONS: { value: PrivacyValue; label: string; hint: string; Icon: typeof IconWorld }[] = [
  { value: "public", label: "Public", hint: "Anyone can see this", Icon: IconWorld },
  { value: "followers", label: "Followers", hint: "Only people who follow you", Icon: IconUsers },
  { value: "private", label: "Only you", hint: "Visible to you alone", Icon: IconLock },
];

export default function CreatePostPage() {
  const { user, profile } = useProfile();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreatePostValues>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      caption: "",
      privacy: (profile?.defaultPrivacy as PrivacyValue) ?? "public",
      hasMedia: false,
    },
  });

  const privacy = useWatch({ control, name: "privacy" });

  function handleFileChange(next: File | null) {
    setFile(next);
    setValue("hasMedia", Boolean(next), { shouldValidate: true });
  }

  // Note: eslint's react-hooks/purity rule flags Date.now() below because this
  // function is passed through React Hook Form's `handleSubmit(...)`, called
  // inline in the JSX. That call only *builds* a submit handler during render
  // -- this function body itself never runs until the form is actually
  // submitted, so it's safe. This is a known rough edge between RHF and the
  // React Compiler's static analysis (the same library the "watch()" warning
  // above this file refers to), not a real purity issue.
  async function onSubmit(values: CreatePostValues) {
    if (!user) return;
    setSubmitError(null);
    try {
      let imageFileId: string | undefined;
      let mediaType: "image" | "video" | undefined;

      if (file) {
        mediaType = file.type.startsWith("video/") ? "video" : "image";
        // eslint-disable-next-line react-hooks/purity -- see note above onSubmit
        const path = `posts/${user.id}/${Date.now()}-${file.name}`;
        const { data: uploaded } = await db.storage.uploadFile(path, file, {
          contentType: file.type,
        });
        imageFileId = uploaded.id;
      }

      const postId = id();
      const chunk = db.tx.posts[postId]
        .update({
          ...(values.caption ? { caption: values.caption } : {}),
          ...(mediaType ? { mediaType } : {}),
          privacy: values.privacy,
          archived: false,
          // eslint-disable-next-line react-hooks/purity -- see note above onSubmit
          createdAt: Date.now(),
        })
        .link({
          author: user.id,
          ...(imageFileId ? { image: imageFileId } : {}),
        });

      await db.transact([chunk]);
      router.push("/feed");
    } catch (err: unknown) {
      const message =
        (err as { body?: { message?: string } })?.body?.message ??
        "Couldn't share that post. Try again.";
      setSubmitError(message);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="font-display text-xl font-semibold mb-5">New post</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono uppercase tracking-wide text-text-faint">
            What&apos;s on your mind?
          </span>
          <textarea
            {...register("caption")}
            placeholder="Write a caption... (optional if you attach a photo or video)"
            rows={3}
            className="bg-surface border border-border rounded-lg px-3.5 py-2.5 text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors resize-none"
          />
          {errors.caption && <p className="text-sm text-negative">{errors.caption.message}</p>}
        </label>

        <UploadDropzone file={file} onChange={handleFileChange} />

        <fieldset className="flex flex-col gap-2">
          <span className="text-xs font-mono uppercase tracking-wide text-text-faint">
            Who can see this
          </span>
          <div className="flex flex-col gap-2">
            {PRIVACY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 cursor-pointer transition-colors ${
                  privacy === option.value
                    ? "border-accent bg-accent-soft"
                    : "border-border hover:border-border-strong"
                }`}
              >
                <input
                  type="radio"
                  value={option.value}
                  {...register("privacy")}
                  className="hidden"
                />
                <option.Icon
                  size={18}
                  className={privacy === option.value ? "text-accent-strong" : "text-text-faint"}
                />
                <div>
                  <p className="text-sm font-medium text-text">{option.label}</p>
                  <p className="text-xs text-text-muted">{option.hint}</p>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        {submitError && <p className="text-sm text-negative">{submitError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-accent hover:bg-accent-strong disabled:opacity-50 text-accent-text font-medium rounded-lg py-2.5 transition-colors"
        >
          {isSubmitting ? "Sharing..." : "Share post"}
        </button>
      </form>
    </div>
  );
}
