import BrandMark from "@/components/BrandMark";

export default function FullScreenLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <BrandMark className="w-8 h-8 text-text-faint animate-pulse" />
    </div>
  );
}
