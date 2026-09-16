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
    appleMeta.content = style;
    document.head.appendChild(appleMeta);
  } else if (appleMeta.content !== style) {
    appleMeta.content = style;
  }

  // 2. Desired theme-color metas
  const desired = [
    { media: null, content: color },
    { media: "(prefers-color-scheme: light)", content: color },
    { media: "(prefers-color-scheme: dark)", content: color },
  ];

  const existingMetas = Array.from(
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
  );

  let hasDiff = existingMetas.length !== desired.length;
  if (!hasDiff) {
    for (const d of desired) {
      const match = existingMetas.find((m) =>
        d.media ? m.getAttribute("media") === d.media : !m.hasAttribute("media")
      );
      if (!match || match.getAttribute("content") !== d.content) {
        hasDiff = true;
        break;
      }
    }
  }

  if (!hasDiff) {
    return; // Already in desired state!
  }

  // Remove and recreate fresh meta tags so Mobile Safari evaluates them immediately
  existingMetas.forEach((m) => m.remove());
  desired.forEach(({ media, content }) => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    if (media) meta.setAttribute("media", media);
    meta.content = content;
    document.head.prepend(meta);
  });
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
  setStatusBarTheme(targetColor, targetStyle);
}

