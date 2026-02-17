import logoImage from "@/assets/logo-dub.png";

/**
 * Avatar do Bot — Clean, sem bordas pesadas
 */
export function BotAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeMap = {
    sm: { container: "h-6 w-6", img: "h-3.5 w-3.5" },
    md: { container: "h-8 w-8", img: "h-4.5 w-4.5" },
    lg: { container: "h-11 w-11", img: "h-6 w-6" },
  };

  const s = sizeMap[size];

  return (
    <div className={`${s.container} rounded-full bg-muted/80 flex items-center justify-center shrink-0`}>
      <img src={logoImage} alt="DUB" className={`${s.img} object-contain`} />
    </div>
  );
}
