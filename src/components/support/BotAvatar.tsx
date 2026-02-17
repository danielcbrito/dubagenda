import logoImage from "@/assets/logo-dub.png";

/**
 * Avatar Premium do Bot — Design limpo e profissional
 */
export function BotAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeMap = {
    sm: { container: "h-7 w-7", img: "h-4 w-4" },
    md: { container: "h-9 w-9", img: "h-5 w-5" },
    lg: { container: "h-14 w-14", img: "h-8 w-8" },
  };

  const s = sizeMap[size];

  return (
    <div 
      className={`${s.container} rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0`}
    >
      <img 
        src={logoImage} 
        alt="Assistente DUB" 
        className={`${s.img} object-contain`}
      />
    </div>
  );
}
