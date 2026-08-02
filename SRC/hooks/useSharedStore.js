// ── Extracted from App.jsx: useSharedStore ──
import { useState, useEffect } from "react";
import { platformStore } from "../utils/platformStore";

export function useSharedStore() {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    platformStore.listeners.add(listener);
    return () => platformStore.listeners.delete(listener);
  }, []);
  return platformStore;
}

