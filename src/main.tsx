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
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
};

window.addEventListener("error", (e) => {
  if (e?.message && isChunkLoadError(e.message)) reloadOnce();
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = (e?.reason?.message || String(e?.reason || "")) as string;
  if (isChunkLoadError(msg)) reloadOnce();
});

createRoot(document.getElementById("root")!).render(<App />);
