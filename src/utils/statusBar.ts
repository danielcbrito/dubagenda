export const RESERVED_SEGMENTS = [
  "cliente", "suporte", "admin", "auth", "barbearias", "b", "i",
  "escolher-barbearia", "escolher-verificacao", "verificar-email",
  "verificar-whatsapp", "completar-perfil", "esqueci-senha",
  "resetar-senha", "flowchart", "responsive-preview", "login", "ajuda"
];

export function isImmersiveRoute(pathname: string): boolean {
  const p = pathname || "";
  if (
    p.startsWith("/escolher-barbearia") ||
    p.startsWith("/b/") ||
    p.startsWith("/barbearia-dub")
  ) {
    return true;
  }
  const segs = p.split("/").filter(Boolean);
  if (segs.length === 1 && !RESERVED_SEGMENTS.includes(segs[0])) {
    return true;
  }
  if (segs.length === 2 && !RESERVED_SEGMENTS.includes(segs[0]) && !RESERVED_SEGMENTS.includes(segs[1])) {
    return true;
  }
  return false;
}

/**
 * Utility to reliably sync mobile status bar color and style across iOS Safari, PWA, and Android Chrome.
 * Replaces all existing theme-color metas to force WebKit and Blink engines to update immediately.
 */
export function setStatusBarTheme(
  color: string,
  style: "black-translucent" | "default" = "black-translucent"
) {
  if (typeof document === "undefined") return;

  // 1. Apple mobile web app status bar style
  let appleMeta = document.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]'
  ) as HTMLMetaElement | null;
  if (!appleMeta) {
    appleMeta = document.createElement("meta");
    appleMeta.name = "apple-mobile-web-app-status-bar-style";
    document.head.appendChild(appleMeta);
  }
  appleMeta.content = style;

  // 2. Remove all existing theme-color tags (WebKit ignores attribute mutation on existing tags)
  const existingMetas = Array.from(
    document.querySelectorAll('meta[name="theme-color"]')
  );
  existingMetas.forEach((m) => m.remove());

  // 3. Prepend fresh theme-color metas for generic, light, and dark schemes
  const newMeta = document.createElement("meta");
  newMeta.name = "theme-color";
  newMeta.content = color;
  document.head.prepend(newMeta);

  const lightMeta = document.createElement("meta");
  lightMeta.name = "theme-color";
  lightMeta.setAttribute("media", "(prefers-color-scheme: light)");
  lightMeta.content = color;
  document.head.prepend(lightMeta);

  const darkMeta = document.createElement("meta");
  darkMeta.name = "theme-color";
  darkMeta.setAttribute("media", "(prefers-color-scheme: dark)");
  darkMeta.content = color;
  document.head.prepend(darkMeta);
}

/**
 * Centralized theme applier:
 * Enforces the exact same background, classes, color-scheme, and status bar
 * across the entire app depending on whether the route is immersive or standard.
 */
export function applyThemeForRoute(pathname: string) {
  if (typeof document === "undefined") return;

  const isImmersive = isImmersiveRoute(pathname);
  const targetColor = isImmersive ? "#000000" : "#FFFFFF";
  const targetStyle = isImmersive ? "black-translucent" : "default";
  const colorScheme = isImmersive ? "dark" : "light";
  const d = document.documentElement;

  // 1. Synchronize classes on <html>
  if (isImmersive) {
    d.classList.add("immersive-active");
    if (pathname.startsWith("/escolher-barbearia")) {
      d.classList.add("immersive-map-active");
      d.classList.remove("immersive-banner-active");
    } else {
      d.classList.add("immersive-banner-active");
      d.classList.remove("immersive-map-active");
    }
  } else {
    d.classList.remove("immersive-active", "immersive-map-active", "immersive-banner-active");
  }

  // 2. Background color & color-scheme on <html> and <body>
  d.style.backgroundColor = targetColor;
  d.style.colorScheme = colorScheme;
  if (document.body) {
    document.body.style.backgroundColor = targetColor;
    document.body.style.colorScheme = colorScheme;
  }

  // 3. Status bar meta tags
  setStatusBarTheme(targetColor, targetStyle);
}

