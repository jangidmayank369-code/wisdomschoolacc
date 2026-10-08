import logoAsset from "@/assets/wps-school-logo.png.asset.json";

export function SchoolLogo({ className = "h-12 w-12", decorative = false }: { className?: string; decorative?: boolean }) {
  return <img src={logoAsset.url} alt={decorative ? "" : "Wisdom Public School Doomra logo"} className={`object-contain ${className}`} decoding="async" />;
}