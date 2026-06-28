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
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        style={style}
        className="rounded-full object-cover border border-border flex-shrink-0"
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
