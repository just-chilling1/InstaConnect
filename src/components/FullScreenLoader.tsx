import BrandMark from "@/components/BrandMark";

export default function FullScreenLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <BrandMark className="w-10 h-10 text-text-faint animate-pulse" />
    </div>
  );
}
