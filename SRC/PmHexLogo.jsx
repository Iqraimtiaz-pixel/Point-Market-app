// ── Extracted from App.jsx: PmHexLogo ──
import React from "react";

export function PmHexLogo({ size = "splash" }) {
  /* splash: full logo with wordmark visible (~260 wide)
     loading: smaller centred mark for the checking screen
     home: compact header mark — sized entirely by its wrapping
     .home-logo-badge container's CSS (width/height/object-fit), not by an
     inline style here. An inline style would always win over the container
     CSS regardless of selector specificity, which was the actual reason the
     header logo was rendering oversized and clipped before. */
  if (size === "home") {
    return <img src="/logo.png" alt="PointMarket" className="pm-logo-home-img" draggable={false} />;
  }
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

