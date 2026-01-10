import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BottomNavItemProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  isCenter?: boolean;
  badgeCount?: number;
}

export function BottomNavItem({
  icon: Icon,
  label,
  onClick,
  isActive = false,
  isCenter = false,
  badgeCount,
}: BottomNavItemProps) {
  if (isCenter) {
    return (
      <motion.button
        onClick={onClick}
        whileTap={{ scale: 0.9 }}
        className="flex flex-col items-center justify-center relative -mt-6"
      >
        {/* Glow effect */}
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-60"
          style={{
            background: "radial-gradient(circle, rgba(239, 68, 68, 0.4), transparent 70%)",
            transform: "scale(1.5)",
          }}
        />

        {/* Main button */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-14 h-14 rounded-full flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
            boxShadow: "0 8px 24px rgba(239, 68, 68, 0.4), 0 4px 12px rgba(0, 0, 0, 0.2)",
          }}
        >
          {/* Inner highlight */}
          <div
            className="absolute inset-0 rounded-full opacity-30"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 50%)",
            }}
          />
          <Icon className="w-6 h-6 text-white relative z-10" strokeWidth={2} />
        </motion.div>

        <span 
          className="text-[10px] font-semibold mt-1.5 tracking-wide"
          style={{ color: "#EF4444" }}
        >
          {label}
        </span>
      </motion.button>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className="flex flex-col items-center justify-center flex-1 py-2 relative group"
    >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
          style={{ background: "#EF4444" }}
        />
      )}

      {/* Icon container */}
      <div className="relative">
        <motion.div
          animate={isActive ? { scale: 1.1 } : { scale: 1 }}
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
            isActive 
              ? "bg-primary/10" 
              : "bg-transparent group-hover:bg-muted/50"
          )}
        >
          <Icon 
            className={cn(
              "w-5 h-5 transition-colors duration-200",
              isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )} 
            strokeWidth={isActive ? 2.5 : 2}
          />

          {/* Badge */}
          {typeof badgeCount === "number" && badgeCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center"
            >
              {badgeCount > 9 ? "9+" : badgeCount}
            </motion.span>
          )}
        </motion.div>
      </div>

      <span 
        className={cn(
          "text-[10px] font-medium mt-0.5 transition-colors duration-200",
          isActive ? "text-primary font-semibold" : "text-muted-foreground group-hover:text-foreground"
        )}
      >
        {label}
      </span>
    </motion.button>
  );
}
