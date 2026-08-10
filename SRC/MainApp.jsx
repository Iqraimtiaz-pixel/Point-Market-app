// ── Extracted from App.jsx: MainApp ──
import CSS from "./styles/global.css?raw";
import React, { useState, useEffect } from "react";
import {
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "./firebase";
import { updateUserProfile } from "./services/userService";
import { startPresence } from "./utils/presence";
import { BottomNav } from "./components/BottomNav";
import { TradeSheet } from "./components/TradeSheet";
import { AiHubScreen } from "./screens/AiHubScreen";
import { BattleScreen } from "./screens/BattleScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { CreateScreen } from "./screens/CreateScreen";
import { DetailScreen } from "./screens/DetailScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { InboxScreen } from "./screens/InboxScreen";
import { ListingsScreen } from "./screens/ListingsScreen";
import { MarketplaceScreen } from "./screens/MarketplaceScreen";
import { MapScreen } from "./screens/MapScreen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { PmSpaceScreen, FindUserScreen } from "./screens/PmSpaceScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SavedScreen } from "./screens/SavedScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { ShopScreen } from "./screens/ShopScreen";
import { WalletScreen } from "./screens/WalletScreen";
import { DEFAULT_LOCATION } from "./utils/location";

export default function MainApp({ initialLocation, currentUser, onLogout, onProfileUpdate }) {
  const [tab,        setTab]       = useState("home");
  const [screen,     setScreen]    = useState(null);
  const [activeItem, setActiveItem]= useState(null);
  const [tradeSheet, setTradeSheet]= useState(false);
  const [activeChat, setActiveChat]= useState(null);
  const [userLocation, setUserLocation] = useState(initialLocation || DEFAULT_LOCATION);
  const [darkMode, setDarkMode] = useState(false);

  // ── Auth guard: if Firebase revokes the token mid-session, force logout ──
  useEffect(() => {
    if (!auth.currentUser) { onLogout(); return; }
    const unsub = onAuthStateChanged(auth, (user) => { if (!user) onLogout(); });
    return unsub;
  }, []);

  // ── Feature 2: presence — online while the app is open, heartbeats
  // lastActiveAt, marks offline on tab hide / close / logout (cleanup runs
  // automatically when MainApp unmounts, which happens on logout). ──
  useEffect(() => {
    if (!currentUser?.uid) return;
    return startPresence(currentUser.uid);
  }, [currentUser?.uid]);

  // ── Follow system: in-memory set of usernames the current user follows ──
  const [followedUsers, setFollowedUsers] = useState(new Set());
  const [activeProfileUser, setActiveProfileUser] = useState(null); // username being viewed in PM Space

  // ── Dark mode: load saved preference, persist on change (real localStorage) ──
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("pm-dark-mode");
      if (saved === "true") setDarkMode(true);
    } catch (e) { /* localStorage unavailable (private browsing) — default to light */ }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("pm-dark-mode", String(next));
      } catch (e) { /* ignore persistence failure, theme still switches for this session */ }
      return next;
    });
  };

  const toggleFollow = (username) => {
    setFollowedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username); else next.add(username);
      return next;
    });
  };

  const openDetail = (item) => { setActiveItem(item); setScreen("detail"); };
  const closeScreen = () => { setScreen(null); setActiveItem(null); setActiveChat(null); setActiveProfileUser(null); };
  const goTo = (s) => setScreen(s);
  const openPmSpace = (username) => { setActiveProfileUser(username); setScreen("pmspace"); };

  return (
    <div className={`kt-root ${darkMode ? "kt-dark" : ""}`}>
      <style>{CSS}</style>
      <div className="kt-phone">

        {/* ── MAIN TABS ── */}
        {!screen && tab === "home"    && <HomeScreen    userLocation={userLocation} currentUser={currentUser} onOpenDetail={openDetail} onTrade={(i) => { setActiveItem(i); setTradeSheet(true); }} onOpenMap={() => setScreen("map")} onOpenProfile={() => { setTab("profile"); setScreen(null); }} onOpenPmSpace={openPmSpace} onOpenCreate={() => { setTab("create"); setScreen(null); }} onOpenProducts={() => setScreen("products")} onOpenSkills={() => setScreen("skills")} />}
        {!screen && tab === "shop"    && <ShopScreen />}
        {!screen && tab === "create"  && <CreateScreen currentUser={currentUser} userLocation={userLocation} />}
        {!screen && tab === "inbox"   && <InboxScreen   onOpenChat={(c) => { setActiveChat(c); setScreen("chat"); }} currentUser={currentUser} />}
        {!screen && tab === "profile" && <ProfileScreen onNavigate={goTo} userLocation={userLocation} currentUser={currentUser} onOpenDetail={openDetail} onProfileUpdate={onProfileUpdate} />}

        {/* ── OVERLAY SCREENS ── */}
        {screen === "detail"   && activeItem  && <DetailScreen   item={activeItem} userLocation={userLocation} onBack={closeScreen} onTrade={() => setTradeSheet(true)} onAiHub={() => setScreen("aihub")} onBattle={() => setScreen("battle")} onOpenPmSpace={openPmSpace} currentUser={currentUser} />}
        {screen === "aihub"    && <AiHubScreen   onBack={closeScreen} />}
        {screen === "battle"   && <BattleScreen  onBack={closeScreen} />}
        {screen === "chat"     && activeChat   && <ChatScreen     chat={activeChat} onBack={closeScreen} currentUser={currentUser} />}
        {screen === "orders"   && <OrdersScreen  onBack={closeScreen} />}
        {screen === "listings" && (
          <ListingsScreen
            onBack={closeScreen}
            currentUser={currentUser}
            onOpenDetail={openDetail}
          />
        )}
        {screen === "products" && <MarketplaceScreen filter="products" userLocation={userLocation} currentUser={currentUser} onBack={closeScreen} onOpenDetail={openDetail} />}
        {screen === "skills"   && <MarketplaceScreen filter="skills"   userLocation={userLocation} currentUser={currentUser} onBack={closeScreen} onOpenDetail={openDetail} />}
        {screen === "saved"    && <SavedScreen   onBack={closeScreen} onOpenDetail={openDetail} currentUser={currentUser} />}
        {screen === "settings" && <SettingsScreen onBack={closeScreen} userLocation={userLocation} onUpdateLocation={async (loc) => { setUserLocation(loc); if (currentUser?.uid) { try { await updateUserProfile(currentUser.uid, { city: loc.city, lat: loc.lat, lng: loc.lng }); } catch (e) { console.warn("Failed to persist location:", e); } } }} onLogout={onLogout} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} currentUser={currentUser} onProfileUpdate={onProfileUpdate} />}
        {screen === "finduser" && <FindUserScreen onBack={closeScreen} onOpenChat={(c) => { setActiveChat(c); setScreen("chat"); }} onOpenPmSpace={openPmSpace} />}
        {screen === "map"      && <MapScreen      onBack={closeScreen} userLocation={userLocation} onOpenDetail={openDetail} />}
        {screen === "wallet"   && <WalletScreen   onBack={closeScreen} currentUser={currentUser} onOpenCreate={() => { setTab("create"); setScreen(null); }} onOpenShop={() => { setTab("shop"); setScreen(null); }} />}
        {screen === "pmspace"  && activeProfileUser && (
          <PmSpaceScreen
            username={activeProfileUser}
            onBack={closeScreen}
            onOpenDetail={openDetail}
            isFollowing={followedUsers.has(activeProfileUser)}
            onToggleFollow={() => toggleFollow(activeProfileUser)}
            onOpenChat={(c) => { setActiveChat(c); setScreen("chat"); }}
          />
        )}

        {/* ── TRADE SHEET ── */}
        {tradeSheet && activeItem && <TradeSheet item={activeItem} onClose={() => setTradeSheet(false)} />}

        {/* ── BOTTOM NAV ── */}
        {!screen && <BottomNav tab={tab} setTab={(t) => { setTab(t); setScreen(null); }} />}
      </div>
    </div>
  );
}

