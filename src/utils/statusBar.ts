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
 * Only mutates the DOM if the current tags do not match desired values.
 */
export function setStatusBarTheme(
  color: string,
  style: "black-translucent" | "default" = "black-translucent",
  colorScheme: "dark" | "light" = color === "#000000" ? "dark" : "light"
) {
  if (typeof document === "undefined") return;

  // 1. Apple mobile web app status bar style
  let appleMeta = document.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]'
  ) as HTMLMetaElement | null;
  if (!appleMeta) {
    appleMeta = document.createElement("meta");
    appleMeta.name = "apple-mobile-web-app-status-bar-style";
    appleMeta.content = style;
    document.head.appendChild(appleMeta);
  } else if (appleMeta.content !== style) {
    appleMeta.content = style;
  }

  // 2. Android Chrome / PWA / WebKit theme-color
  const existingMetas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (existingMetas.length > 0) {
    existingMetas.forEach((m) => {
      if (m.getAttribute("content") !== color) {
        m.setAttribute("content", color);
      }
      if (m.content !== color) {
        m.content = color;
      }
    });
  } else {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.id = "theme-color-meta";
    meta.setAttribute("content", color);
    meta.content = color;
    document.head.appendChild(meta);
  }

  // 3. Color scheme meta tag (crucial for Android status bar icons white vs dark)
  let colorSchemeMeta = document.querySelector(
    'meta[name="color-scheme"]'
  ) as HTMLMetaElement | null;
  if (!colorSchemeMeta) {
    colorSchemeMeta = document.createElement("meta");
    colorSchemeMeta.name = "color-scheme";
    colorSchemeMeta.id = "color-scheme-meta";
    document.head.appendChild(colorSchemeMeta);
  }
  if (colorSchemeMeta.content !== colorScheme) {
    colorSchemeMeta.setAttribute("content", colorScheme);
    colorSchemeMeta.content = colorScheme;
  }
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
    if (!d.classList.contains("immersive-active")) d.classList.add("immersive-active");
    if (pathname.startsWith("/escolher-barbearia")) {
      if (!d.classList.contains("immersive-map-active")) d.classList.add("immersive-map-active");
      d.classList.remove("immersive-banner-active");
    } else {
      if (!d.classList.contains("immersive-banner-active")) d.classList.add("immersive-banner-active");
      d.classList.remove("immersive-map-active");
    }
  } else {
    d.classList.remove("immersive-active", "immersive-map-active", "immersive-banner-active");
  }

  // 2. Background color & color-scheme on <html> and <body>
  if (d.style.backgroundColor !== targetColor) {
    d.style.backgroundColor = targetColor;
  }
  if (d.style.colorScheme !== colorScheme) {
    d.style.colorScheme = colorScheme;
  }
  if (document.body) {
    if (document.body.style.backgroundColor !== targetColor) {
      document.body.style.backgroundColor = targetColor;
    }
    if (document.body.style.colorScheme !== colorScheme) {
      document.body.style.colorScheme = colorScheme;
    }
  }

  // 3. Status bar meta tags
  setStatusBarTheme(targetColor, targetStyle, colorScheme);
}

