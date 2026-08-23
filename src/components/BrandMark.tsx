type BrandMarkProps = {
  className?: string;
};

/**
 * The app's brand mark logo.
 */
export default function BrandMark({ className }: BrandMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt=""
      aria-hidden="true"
      className={`object-contain ${className ?? ""}`}
    />
  );
}
