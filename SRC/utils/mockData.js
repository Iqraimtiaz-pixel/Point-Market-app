// ── Extracted from App.jsx: AI_SUGGESTIONS, BATTLE_OFFERS, FAQ_ITEMS, FEED, ORDERS, ORDER_TABS, SAMPLE_COMMENTS, SAMPLE_REVIEWS, USER_DIRECTORY ──
import {
  Inbox,
  Package,
  Truck,
  RotateCcw,
  XCircle
} from "lucide-react";

export const FEED = [];


export const SAMPLE_COMMENTS = [];


export const BATTLE_OFFERS = [];


export const AI_SUGGESTIONS = {
  available: [],
  similar: [],
};


export const ORDER_TABS = [
  { key: "give",      label: "To Give",    icon: Package },
  { key: "ship",      label: "To Ship",    icon: Truck },
  { key: "receive",   label: "To Receive", icon: Inbox },
  { key: "returned",  label: "Returned",   icon: RotateCcw },
  { key: "cancelled", label: "Cancelled",  icon: XCircle },
];


export const ORDERS = {
  give:      [],
  ship:      [],
  receive:   [],
  returned:  [],
  cancelled: [],
};


export const FAQ_ITEMS = [
  { q: "How do I trade an item?",          a: "Open any post and tap the handshake icon to offer your own item or PM Points." },
  { q: "How is AI value calculated?",      a: "Our AI compares your item to similar recent trades to suggest a fair PM Point value." },
  { q: "How do I boost my post?",          a: "Go to Shop → Premium Post Boost, upload your video, and pay Rs. 150 via JazzCash. Your payment is verified automatically by AI." },
  { q: "What is Verified Pro Seller?",     a: "A paid certification badge that shows buyers you're a trusted, verified trader on Point Maker." },
];


export const USER_DIRECTORY = [];


export const SAMPLE_REVIEWS = [];

