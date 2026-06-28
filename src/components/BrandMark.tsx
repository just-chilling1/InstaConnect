type BrandMarkProps = {
  className?: string;
};

/**
 * The app's brand mark: a simplified camera-iris glyph.
 * Renders in `currentColor` so it adapts wherever it's placed.
 */
export default function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1.2" />
      <polygon
        points="12,5 18.1,8.5 18.1,15.5 12,19 5.9,15.5 5.9,8.5"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}
