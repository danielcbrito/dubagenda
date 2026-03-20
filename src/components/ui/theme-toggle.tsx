"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <div
      className={cn(
        "flex w-14 h-7 p-[3px] rounded-full cursor-pointer transition-colors duration-300",
        isDark
          ? "bg-card border border-border/50"
          : "bg-muted border border-border/30",
        className
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      role="button"
      tabIndex={0}
    >
      <div className="relative w-full h-full">
        <motion.div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full shadow-sm",
            isDark ? "bg-foreground/90" : "bg-foreground/85"
          )}
          animate={{ x: isDark ? 0 : 23 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
        <div className="absolute top-1/2 -translate-y-1/2 left-0 w-[22px] h-[22px] flex items-center justify-center z-10">
          <Moon
            className={cn(
              "w-3.5 h-3.5 transition-colors",
              isDark ? "text-background" : "text-muted-foreground/25"
            )}
            strokeWidth={1.8}
          />
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 right-0 w-[22px] h-[22px] flex items-center justify-center z-10">
          <Sun
            className={cn(
              "w-3.5 h-3.5 transition-colors",
              isDark ? "text-muted-foreground/25" : "text-background"
            )}
            strokeWidth={1.8}
          />
        </div>
      </div>
    </div>
  )
}
