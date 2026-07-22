// =============================================================================
//  src/components/AdsterraNativeBanner.jsx  ·  Point Market — Native Ad Slot
//
//  Reusable wrapper around the AdsTerra Native Banner unit.
//
//    <script async data-cfasync="false"
//            src="https://pl30435570.effectivecpmnetwork.com/65f6a659e2a4ae8b14ad8c87680d4cff/invoke.js"></script>
//    <div id="container-65f6a659e2a4ae8b14ad8c87680d4cff"></div>
//
//  Design goals (see integration requirements):
//   1. The <script src="..."> tag is only ever appended to the DOM once,
//      no matter how many times this component mounts across the app's
//      lifetime, and no matter how many <AdsterraNativeBanner /> instances
//      are rendered at once (Home feed, Shop, Wallet, etc).
//   2. Navigating between screens (mount → unmount → mount again) never
//      re-injects the script tag.
//   3. Unmounting always cleans up its own timers/observers — it never
//      touches or removes the shared <script> tag, since other mounted
//      instances (or a future one) may still depend on it.
//   4. If no ad content ever appears in the container (blocked by an
//      ad-blocker, network failure, empty fill, etc.) the slot quietly
//      collapses to zero height instead of leaving an empty box.
//   5. A fixed-height placeholder is reserved up front so the ad loading
//      in/out never shifts surrounding layout, and the whole thing is
//      fully responsive (scales to its parent's width).
// =============================================================================
import { useEffect, useRef, useState } from "react";

const AD_SCRIPT_SRC   = "https://pl30435570.effectivecpmnetwork.com/65f6a659e2a4ae8b14ad8c87680d4cff/invoke.js";
const AD_BASE_ID      = "container-65f6a659e2a4ae8b14ad8c87680d4cff";
const FILL_TIMEOUT_MS = 4000; // how long we wait for content before treating the slot as failed

// ── Module-level singletons — shared by every instance of this component,
// for the lifetime of the page (persists across React mounts/unmounts). ──
let scriptLoadPromise = null;
let instanceCount     = 0;

function loadAdsterraScriptOnce() {
  if (scriptLoadPromise) return scriptLoadPromise; // already loading/loaded — reuse it

  scriptLoadPromise = new Promise((resolve) => {
    // Guard against a script tag already existing (e.g. injected by a
    // previous page load / hot-reload) so we truly never duplicate it.
    const existing = document.querySelector(`script[src="${AD_SCRIPT_SRC}"]`);
    if (existing) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src   = AD_SCRIPT_SRC;
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}

// Inject the small amount of scoped CSS this component needs exactly once,
// regardless of how many banners get rendered on the page.
let stylesInjected = false;
function injectStylesOnce() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-adsterra-native-styles", "true");
  style.textContent = `
    .adsterra-native-slot {
      width: 100%;
      max-width: 100%;
      margin: 14px 0;
      min-height: 90px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      transition: max-height .25s ease, opacity .25s ease, margin .25s ease;
      box-sizing: border-box;
    }
    .adsterra-native-slot.adsterra-hidden {
      min-height: 0;
      max-height: 0;
      opacity: 0;
      margin: 0;
      pointer-events: none;
    }
    .adsterra-native-slot .adsterra-native-inner {
      width: 100%;
      max-width: 100%;
      overflow: hidden;
    }
    .adsterra-native-slot .adsterra-native-inner * {
      max-width: 100% !important;
    }
    .adsterra-native-label {
      font-size: 10px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted, #8a97a3);
      text-align: center;
      margin-bottom: 4px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * <AdsterraNativeBanner />
 * Drop this in anywhere ads are allowed (Home feed, Shop, Wallet). It is
 * safe to render several at once on the same screen — each gets its own
 * non-conflicting container id, the shared script is fetched only once,
 * and any slot that doesn't fill hides itself automatically.
 */
export default function AdsterraNativeBanner({ className = "" }) {
  const [failed, setFailed] = useState(false);
  const containerRef = useRef(null);
  const timeoutRef   = useRef(null);
  const observerRef   = useRef(null);
  const idRef         = useRef(null);

  if (idRef.current === null) {
    instanceCount += 1;
    // Keep the exact id from the ad snippet for the first slot on the page;
    // any additional simultaneous slots get a numbered suffix so we never
    // render two elements with the same id in the DOM.
    idRef.current = instanceCount === 1 ? AD_BASE_ID : `${AD_BASE_ID}-${instanceCount}`;
  }

  useEffect(() => {
    injectStylesOnce();
    let cancelled = false;

    loadAdsterraScriptOnce().then((ok) => {
      if (cancelled) return;
      if (!ok) { setFailed(true); return; }

      // Give the ad network a few seconds to actually paint something into
      // our container. If nothing shows up, hide the slot instead of
      // leaving a blank box on the page.
      timeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        const el = containerRef.current;
        if (!el || el.childElementCount === 0) {
          setFailed(true);
        }
      }, FILL_TIMEOUT_MS);

      // Also watch for content being injected/removed later (some ad
      // networks briefly insert and then clear an empty response).
      if (containerRef.current && "MutationObserver" in window) {
        observerRef.current = new MutationObserver(() => {
          const el = containerRef.current;
          if (el && el.childElementCount === 0) {
            setFailed(true);
          }
        });
        observerRef.current.observe(containerRef.current, { childList: true, subtree: true });
      }
    });

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (observerRef.current) observerRef.current.disconnect();
      // NOTE: we deliberately never remove the shared <script> tag here —
      // it's a page-lifetime singleton other banner instances may rely on.
    };
  }, []);

  return (
    <div
      className={`adsterra-native-slot${failed ? " adsterra-hidden" : ""} ${className}`}
      aria-hidden={failed}
    >
      {!failed && (
        <div className="adsterra-native-inner">
          <div className="adsterra-native-label">Advertisement</div>
          <div id={idRef.current} ref={containerRef} />
        </div>
      )}
    </div>
  );
}
