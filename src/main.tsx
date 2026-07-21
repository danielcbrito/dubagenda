import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-reload when a stale dynamic chunk fails to load (after a new deploy)
const isChunkLoadError = (msg: string) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(
    msg
  );

const reloadOnce = () => {
  const key = "__chunk_reload_at";
  const last = Number(sessionStorage.getItem(key) || 0);
  const now = Date.now();
  if (now - last > 10_000) {
    sessionStorage.setItem(key, String(now));
    // Cache-busting hard reload so we don't re-fetch the stale index.html
    const url = new URL(window.location.href);
    url.searchParams.set("_r", String(now));
    window.location.replace(url.toString());
  }
};

window.addEventListener("error", (e) => {
  if (e?.message && isChunkLoadError(e.message)) reloadOnce();
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = (e?.reason?.message || String(e?.reason || "")) as string;
  if (isChunkLoadError(msg)) reloadOnce();
});
// Vite emits this specifically for failed dynamic import preloads
window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault();
  reloadOnce();
});


createRoot(document.getElementById("root")!).render(<App />);
