// ── Extracted from App.jsx: ABOUT_FAQ, ABOUT_SECTIONS, AboutSheet ──
import React, { useState } from "react";
import {
  MessageCircle,
  Home,
  ChevronRight,
  Info
} from "lucide-react";
import { ContactSupportSheet } from "./ContactSupportSheet";

export const ABOUT_SECTIONS = [
  { q: "What is Point Maker?", a: "Point Maker (PM) is a video-first barter and trading marketplace. Instead of using cash, members trade physical items, services, and skills directly with each other — or use PM Points as a flexible in-between currency when a direct swap doesn't line up." },
  { q: "How does the Point System work?", a: "Every member has a PM Points (PM) balance. PM can be earned by trading fairly, offering items others want, and maintaining a high Karma Score. PM can be spent to top up an offer, boost a post, or get Verified Pro Seller certification." },
  { q: "How do I earn points?", a: "Complete your first trade to unlock your locked welcome bonus, receive PM directly from other traders as part of an offer, and keep a high Karma Score by shipping fast, communicating clearly, and avoiding cancellations." },
  { q: "How do I spend points?", a: "Use PM to sweeten a trade offer (e.g. \"my headphones + 200 PM\"), boost a listing to the top of the Home feed for 24 hours, or pay for Verified Pro Seller certification — all from the Shop tab." },
  { q: "Product trading guide", a: "Upload a clear video or photo of your item, write an honest title and description, and specify what you'd like in return. Our AI Authenticity Engine scans every upload for condition, authenticity, and quality before it goes live." },
  { q: "Skill trading guide", a: "List a skill the same way you'd list an item — record a short demo video, describe what's included (e.g. \"1-hour guitar lesson\"), and set what you're hoping to trade for. Skills are scored for credibility just like products." },
  { q: "How does AI point valuation work?", a: "When you upload a listing, our AI Authenticity & Karma Scoring Engine analyzes authenticity, condition, content quality, category value, and listing completeness to recommend a fair PM Point value — so trades stay balanced without manual guesswork." },
  { q: "What does the Verified badge mean?", a: "A Verified Pro Seller badge means a trader has paid for and passed Point Maker's skill/identity certification. It signals extra trustworthiness on top of their regular Karma Score and trade history." },
  { q: "Community guidelines", a: "Be honest about an item's condition, never list something you don't own or can't deliver, communicate respectfully, and follow through on accepted trades. Misleading listings or repeated cancellations will lower your Karma Score." },
];


export const ABOUT_FAQ = [
  { q: "Is Point Maker free to use?", a: "Yes — browsing, listing, and trading are completely free. Optional paid features like Post Boost and Verified certification are paid securely through JazzCash." },
  { q: "What happens if a trade goes wrong?", a: "Open the chat with your trade partner first to resolve it directly. Repeated issues affect both parties' Karma Score and may be reviewed by moderation." },
  { q: "Can I trade across cities?", a: "Yes, though Point Maker prioritizes same-city and nearby matches first for faster, easier handoffs. You can still browse and trade with anyone." },
];


export function AboutSheet({ onClose }) {
  const [open, setOpen] = useState(null);
  const [faqOpen, setFaqOpen] = useState(null);
  const [showContact, setShowContact] = useState(false);

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">About Point Maker</h3>
        <p className="sheet-sub">Everything you need to know to get the most out of PM.</p>

        {ABOUT_SECTIONS.map((s, i) => (
          <div key={i} className="faq-item" onClick={() => setOpen(open === i ? null : i)}>
            <div className="faq-q">{s.q}<ChevronRight size={15} style={{ transform: open === i ? "rotate(90deg)" : "none", transition: "transform .15s", color: "#6f8b80", flexShrink: 0 }} /></div>
            {open === i && <div className="faq-a">{s.a}</div>}
          </div>
        ))}

        <div className="section-title" style={{ padding: "16px 0 8px" }}>Frequently Asked Questions</div>
        {ABOUT_FAQ.map((f, i) => (
          <div key={i} className="faq-item" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
            <div className="faq-q">{f.q}<ChevronRight size={15} style={{ transform: faqOpen === i ? "rotate(90deg)" : "none", transition: "transform .15s", color: "#6f8b80", flexShrink: 0 }} /></div>
            {faqOpen === i && <div className="faq-a">{f.a}</div>}
          </div>
        ))}

        <button className="kt-btn" style={{ marginTop: 14 }} onClick={() => setShowContact(true)}><MessageCircle size={15} /> Contact support</button>

        <div className="about-version">
          <Info size={13} /> Point Maker (PM) · Version 2.4.0
        </div>
      </div>
      {showContact && <ContactSupportSheet onClose={() => setShowContact(false)} />}
    </div>
  );
}

