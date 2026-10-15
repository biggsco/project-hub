"use client";
import { useEffect, useState } from "react";
export default function Pwa() {
  const [install, setInstall] = useState<any>(null);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    const ready = (e: Event) => {
      e.preventDefault();
      setInstall(e);
    };
    window.addEventListener("beforeinstallprompt", ready);
    return () => window.removeEventListener("beforeinstallprompt", ready);
  }, []);
  return install ? (
    <button
      className="install-app secondary"
      onClick={async () => {
        await install.prompt();
        setInstall(null);
      }}
    >
      Install Project Hub
    </button>
  ) : null;
}
