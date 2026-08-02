// ── Extracted from App.jsx: PmHexLogo ──
import React from "react";

export function PmHexLogo({ size = "splash" }) {
  /* splash: full logo with wordmark visible (~260 wide)
     loading: smaller centred mark for the checking screen */
  const style = size === "loading"
    ? { width: 180, height: "auto", animation: "logoFadeIn 0.8s ease-out" }
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

