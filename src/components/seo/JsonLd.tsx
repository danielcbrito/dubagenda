import { useEffect } from "react";

/**
 * Injects a JSON-LD <script> into <head> for the lifetime of the component.
 * Uses a stable id so re-renders replace the previous payload instead of stacking.
 */
export function JsonLd({ id, data }: { id: string; data: unknown }) {
  useEffect(() => {
    if (!data) return;
    const elId = `ld-${id}`;
    let el = document.getElementById(elId) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = elId;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
    return () => {
      el?.remove();
    };
  }, [id, data]);
  return null;
}
