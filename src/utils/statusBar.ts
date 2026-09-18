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
  // Em navegadores baseados em Chromium/Android, remover e reinserir força o repaint nativo da barra de status
  const existingMetas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  existingMetas.forEach((m) => m.remove());

  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.id = "theme-color-meta";
  meta.setAttribute("content", color);
  meta.content = color;
  document.head.appendChild(meta);

  // 3. Color scheme meta tag (crucial para ícones da barra de status claros vs escuros)
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
 * No mapa: usa a cor idêntica ao canvas do Google Maps (#E5E3DF) para fusão invisível sem faixa branca ou preta.
 * No perfil da barbearia: usa o tom neutro/escuro (#171717) para fundir perfeitamente com a foto de capa.
 * Nas demais páginas: branco (#FFFFFF).
 */
export function applyThemeForRoute(pathname: string) {
  if (typeof document === "undefined") return;

  const isMap = pathname.startsWith("/escolher-barbearia");
  const isBanner = pathname.startsWith("/b/") || pathname.startsWith("/barbearia-dub") || (isImmersiveRoute(pathname) && !isMap);
  const isImmersive = isMap || isBanner;

  const targetColor = isMap ? "#E5E3DF" : (isBanner ? "#171717" : "#FFFFFF");
  const targetStyle = isImmersive ? "black-translucent" : "default";
  const colorScheme = isBanner ? "dark" : "light";
  const d = document.documentElement;

  if (isImmersive) {
    d.classList.add("immersive-active");
    if (isMap) {
      d.classList.add("immersive-map-active");
      d.classList.remove("immersive-banner-active");
    } else {
      d.classList.add("immersive-banner-active");
      d.classList.remove("immersive-map-active");
    }
    d.classList.remove("light");
  } else {
    d.classList.remove("immersive-active", "immersive-map-active", "immersive-banner-active", "dark");
    if (!d.classList.contains("light")) d.classList.add("light");
  }

  // Define a cor de fundo exata em html e body para que puxar (overscroll) revele a cor do mapa, NUNCA branco
  d.style.backgroundColor = targetColor;
  if (document.body) {
    document.body.style.backgroundColor = targetColor;
  }

  if (d.style.colorScheme !== colorScheme) {
    d.style.colorScheme = colorScheme;
  }
  if (document.body && document.body.style.colorScheme !== colorScheme) {
    document.body.style.colorScheme = colorScheme;
  }

  // Status bar meta tags
  setStatusBarTheme(targetColor, targetStyle, colorScheme);
}

