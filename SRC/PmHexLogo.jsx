
// ── Extracted from App.jsx: PmHexLogo ──
import React from "react";

export function PmHexLogo({ size = "splash" }) {
  /* splash: full logo with wordmark visible (~260 wide)
     loading: smaller centred mark for the checking screen
     home: compact header mark for the Home Screen top bar (~120 wide) */
  const style = size === "loading"
    ? { width: 180, height: "auto", animation: "logoFadeIn 0.8s ease-out" }
    : size === "home"
    ? { width: 120, height: "auto" }
    : { width: 260, height: "auto", animation: "logoFadeIn 0.8s ease-out" };
  return (
    <img
      src="/logo.png"
      alt="PointMarket"
      style={style}
      draggable={false}
    />
  );
}


