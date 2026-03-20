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
      <div className="flex justify-between items-center w-full relative">
        <motion.div
          className={cn(
            "absolute w-[22px] h-[22px] rounded-full shadow-sm",
            isDark ? "bg-foreground/90" : "bg-foreground/85"
          )}
          animate={{ x: isDark ? 0 : 23 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
        <div className="flex justify-center items-center w-[22px] h-[22px] z-10">
          <Moon
            className={cn(
              "w-3.5 h-3.5 transition-colors",
              isDark ? "text-muted-foreground/30" : "text-background"
            )}
            strokeWidth={1.8}
          />
        </div>
        <div className="flex justify-center items-center w-[22px] h-[22px] z-10">
          <Sun
            className={cn(
              "w-3.5 h-3.5 transition-colors",
              isDark ? "text-background" : "text-muted-foreground/30"
            )}
            strokeWidth={1.8}
          />
        </div>
      </div>
    </div>
  )
}
