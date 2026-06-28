"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import db from "@/lib/db";
import Avatar from "@/components/Avatar";
import { IconUpload } from "@tabler/icons-react";

type EditProfileFormProps = {
  profile: {
    id: string;
    displayName: string;
    bio?: string | null;
    website?: string | null;
    location?: string | null;
    avatar?: { url: string } | null;
  };
  userId: string;
  onDone: () => void;
};

export default function EditProfileForm({ profile, userId, onDone }: EditProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar?.url ?? null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      let avatarFileId: string | undefined;
      if (avatarFile) {
        const path = `avatars/${userId}/${Date.now()}-${avatarFile.name}`;
        const { data } = await db.storage.uploadFile(path, avatarFile, {
          contentType: avatarFile.type,
        });
        avatarFileId = data.id;
      }

      const chunk = db.tx.profiles[profile.id].update({
        displayName: displayName.trim(),
        ...(bio.trim() ? { bio: bio.trim() } : { bio: "" }),
        ...(website.trim() ? { website: website.trim() } : { website: "" }),
        ...(location.trim() ? { location: location.trim() } : { location: "" }),
      });

      await db.transact(
        avatarFileId ? [chunk.link({ avatar: avatarFileId })] : [chunk]
      );
      onDone();
    } catch (err: unknown) {
      const message =
        (err as { body?: { message?: string } })?.body?.message ?? "Couldn't save changes.";
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 border border-border bg-surface rounded-xl p-5"
    >
      <label className="self-center cursor-pointer group relative">
        <Avatar url={avatarPreview} name={displayName || "?"} size={80} />
        <span className="absolute inset-0 rounded-full bg-ink/0 group-hover:bg-ink/40 flex items-center justify-center transition-colors">
          <IconUpload
            size={18}
            className="text-text opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </span>
        <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-mono uppercase tracking-wide text-text-faint">
          Display name
        </span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          className="bg-ink border border-border rounded-lg px-3.5 py-2 text-text outline-none focus:border-accent transition-colors"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-mono uppercase tracking-wide text-text-faint">Bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="bg-ink border border-border rounded-lg px-3.5 py-2 text-text outline-none focus:border-accent transition-colors resize-none"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-mono uppercase tracking-wide text-text-faint">Website</span>
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://..."
          className="bg-ink border border-border rounded-lg px-3.5 py-2 text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-mono uppercase tracking-wide text-text-faint">Location</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, Country"
          className="bg-ink border border-border rounded-lg px-3.5 py-2 text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors"
        />
      </label>

      {errorMsg && <p className="text-sm text-negative">{errorMsg}</p>}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onDone}
          className="text-sm font-medium text-text-muted hover:text-text px-3.5 py-2 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="bg-accent hover:bg-accent-strong disabled:opacity-50 text-accent-text font-medium rounded-lg px-4 py-2 text-sm transition-colors"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
