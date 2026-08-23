"use client";

import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { IconPhotoPlus, IconX, IconVideo } from "@tabler/icons-react";

type UploadDropzoneProps = {
  file: File | null;
  onChange: (file: File | null) => void;
  /** Restrict the picker to one media type. Defaults to accepting both. */
  accept?: "image" | "video" | "both";
};

function isAcceptable(file: File, accept: "image" | "video" | "both") {
  if (accept === "image") return file.type.startsWith("image/");
  if (accept === "video") return file.type.startsWith("video/");
  return file.type.startsWith("image/") || file.type.startsWith("video/");
}

export default function UploadDropzone({ file, onChange, accept = "both" }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  function setFile(next: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(next ? URL.createObjectURL(next) : null);
    onChange(next);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && isAcceptable(dropped, accept)) {
      setFile(dropped);
    }
  }

  function handleSelect(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  }

  const inputAccept =
    accept === "image" ? "image/*" : accept === "video" ? "video/*" : "image/*,video/*";
  const isVideo = file?.type.startsWith("video/");

  if (file && preview) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-border bg-surface">
        {isVideo ? (
          <video
            src={preview}
            controls
            className="w-full max-h-[480px] bg-ink"
            aria-label="Selected video preview"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Selected photo preview"
            className="w-full max-h-[480px] object-contain"
          />
        )}
        <button
          type="button"
          onClick={() => setFile(null)}
          className="absolute top-3 right-3 bg-ink/70 hover:bg-ink text-text rounded-full p-1.5 transition-colors"
          aria-label="Remove media"
        >
          <IconX size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer py-16 px-6 text-center transition-colors ${
        dragging ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong"
      }`}
    >
      {accept === "video" ? (
        <IconVideo size={28} className="text-text-faint" />
      ) : (
        <IconPhotoPlus size={28} className="text-text-faint" />
      )}
      <p className="text-sm text-text-muted">
        Drag {accept === "video" ? "a video" : accept === "image" ? "a photo" : "a photo or video"}{" "}
        here, or click to choose one
      </p>
      <p className="text-xs font-mono text-text-faint">
        {accept === "video" ? "MP4, WEBM, or MOV" : accept === "image" ? "JPG, PNG, or WEBP" : "Images or video"}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={inputAccept}
        onChange={handleSelect}
        className="hidden"
      />
    </div>
  );
}
