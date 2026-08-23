import Image from "next/image";

type AvatarProps = {
  url?: string | null;
  name: string;
  size?: number;
};

export default function Avatar({ url, name, size = 40 }: AvatarProps) {
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "?";
  const style = { width: size, height: size };

  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover border border-border flex-shrink-0"
        style={style}
      />
    );
  }

  return (
    <div
      style={style}
      className="rounded-full bg-surface-2 border border-border text-text-muted flex items-center justify-center font-display font-medium flex-shrink-0"
    >
      {initial}
    </div>
  );
}
