"use client";

import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { id } from "@instantdb/react";
import { IconUpload } from "@tabler/icons-react";
import db from "@/lib/db";
import { useProfile } from "@/lib/useProfile";
import FullScreenLoader from "@/components/FullScreenLoader";
import BrandMark from "@/components/BrandMark";
import Avatar from "@/components/Avatar";

export default function OnboardingPage() {
  const { user, hasProfile, isLoading } = useProfile();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (hasProfile) {
      router.replace("/feed");
    }
  }, [isLoading, user, hasProfile, router]);

  if (isLoading || !user || hasProfile) {
    return <FullScreenLoader />;
  }

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !displayName.trim()) {
      setErrorMsg("Username and display name are required.");
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      setErrorMsg("Usernames are 3-20 characters: lowercase letters, numbers, underscores.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      let avatarFileId: string | undefined;
      if (avatarFile) {
        const path = `avatars/${user!.id}/${Date.now()}-${avatarFile.name}`;
        const { data } = await db.storage.uploadFile(path, avatarFile, {
          contentType: avatarFile.type,
        });
        avatarFileId = data.id;
      }

      const profileId = id();
      await db.transact([
        db.tx.profiles[profileId]
          .update({
            username: cleanUsername,
            displayName: displayName.trim(),
            ...(bio.trim() ? { bio: bio.trim() } : {}),
            createdAt: Date.now(),
          })
          .link({
            user: user!.id,
            ...(avatarFileId ? { avatar: avatarFileId } : {}),
          }),
      ]);
      router.replace("/feed");
    } catch (err: unknown) {
      const message =
        (err as { body?: { message?: string } })?.body?.message ??
        "That username may already be taken. Try another.";
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 min-h-screen flex items-center justify-center px-4 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 mb-2">
          <BrandMark className="w-9 h-9 text-accent" />
          <h1 className="font-display text-2xl font-semibold text-text">Set up your profile</h1>
          <p className="text-text-muted text-sm text-center">
            This is how other people on InstaConnect will recognize you.
          </p>
        </div>

        <label className="self-center cursor-pointer group relative">
          <Avatar url={avatarPreview} name={displayName || "?"} size={88} />
          <span className="absolute inset-0 rounded-full bg-ink/0 group-hover:bg-ink/40 flex items-center justify-center transition-colors">
            <IconUpload
              size={20}
              className="text-text opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </span>
          <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono uppercase tracking-wide text-text-faint">
            Username
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="jane_doe"
            required
            className="bg-surface border border-border rounded-lg px-3.5 py-2.5 text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono uppercase tracking-wide text-text-faint">
            Display name
          </span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jane Doe"
            required
            className="bg-surface border border-border rounded-lg px-3.5 py-2.5 text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono uppercase tracking-wide text-text-faint">
            Bio <span className="text-text-faint/70">(optional)</span>
          </span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What do you shoot?"
            rows={3}
            className="bg-surface border border-border rounded-lg px-3.5 py-2.5 text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors resize-none"
          />
        </label>

        {errorMsg && <p className="text-sm text-negative">{errorMsg}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-accent hover:bg-accent-strong disabled:opacity-50 text-accent-text font-medium rounded-lg py-2.5 transition-colors"
        >
          {submitting ? "Saving..." : "Continue to feed"}
        </button>
      </form>
    </div>
  );
}
