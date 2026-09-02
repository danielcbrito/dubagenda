import { useEffect, useRef } from "react";

const DEFAULT_THEME_COLOR = "#FFFFFF";

/**
 * Dynamically updates <meta name="theme-color"> when the screen changes.
 * Removes duplicate meta tags (iOS reads the first one), sets html/body
 * background to the same color, and restores the default on unmount.
 */
export function useStatusBarColor(color: string = DEFAULT_THEME_COLOR) {
  const previousColorRef = useRef<string>(DEFAULT_THEME_COLOR);

  useEffect(() => {
    if (typeof document === "undefined") return;

    // Store the current theme-color before changing, so we can restore it on unmount
    const existingMeta = document.querySelector('meta[name="theme-color"]');
    if (existingMeta) {
      previousColorRef.current = existingMeta.getAttribute("content") || DEFAULT_THEME_COLOR;
    }

    // Remove all duplicate theme-color metas (iOS bug: reads the first one)
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.remove());

    // Create a fresh, single meta tag with the desired color
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = color;
    document.head.appendChild(meta);

    // Match the app background so the status bar blends seamlessly
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;

    return () => {
      meta.remove();
      document.documentElement.style.backgroundColor = DEFAULT_THEME_COLOR;
      document.body.style.backgroundColor = DEFAULT_THEME_COLOR;

      // Restore the previous theme-color meta if it wasn't the default
      if (previousColorRef.current !== DEFAULT_THEME_COLOR) {
        const restoredMeta = document.createElement("meta");
        restoredMeta.name = "theme-color";
        restoredMeta.content = previousColorRef.current;
        document.head.appendChild(restoredMeta);
      }
    };
  }, [color]);
}
