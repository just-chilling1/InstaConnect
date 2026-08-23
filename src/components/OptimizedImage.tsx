import Image from "next/image";

type OptimizedImageProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fill?: boolean;
  priority?: boolean;
};

/** next/image wrapper for InstantDB storage URLs. */
export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = "",
  fill,
  priority,
}: OptimizedImageProps) {
  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        sizes="(max-width: 768px) 100vw, 640px"
        priority={priority}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 640}
      height={height ?? 640}
      className={className}
      sizes="(max-width: 768px) 100vw, 640px"
      priority={priority}
    />
  );
}
