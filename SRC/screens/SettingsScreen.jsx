// ── Extracted from App.jsx: SettingsScreen ──
import React, { useState } from "react";
import {
  Bell,
  MessageCircle,
  User,
  ChevronLeft,
  Users,
  Settings as SettingsIcon,
  Smartphone,
  Handshake,
  Lock,
  MapPin,
  Info,
  Flag
} from "lucide-react";
import { AboutSheet } from "../Profile/AboutSheet";
import { EditProfileSheet } from "../Profile/EditProfileSheet";
import { HelpSheet } from "../Profile/HelpSheet";
import { PhoneNumberSheet } from "../Profile/PhoneNumberSheet";
import { PrivacySheet } from "../Profile/PrivacySheet";
import { ReportProblemSheet } from "../Profile/ReportProblemSheet";
import { UpdateLocationSheet } from "../Profile/UpdateLocationSheet";
import { MenuRow } from "../components/MenuRow";
import { ToggleRow } from "../components/ToggleRow";

export function SettingsScreen({ onBack, userLocation, onUpdateLocation, onLogout, darkMode, onToggleDarkMode, currentUser, onProfileUpdate }) {
  const [toggles, setToggles] = useState({ notifications: true, tradeAlerts: true, publicProfile: true });
  const flip = (key) => setToggles((t) => ({ ...t, [key]: !t[key] }));
  const [sheet, setSheet] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await onLogout();
  };

  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>Settings</h2>
      </div>

      <div className="section-title">Account</div>
      <MenuRow icon={User}        label="Edit profile"  onClick={() => setSheet("profile")} />
      <MenuRow icon={Smartphone}  label="Phone number"  onClick={() => setSheet("phone")} />
      <MenuRow icon={MapPin}      label="Location"      sub={userLocation?.city ? `${userLocation.city}${userLocation?.completeAddress ? " · Confirmed" : ""}` : "Not set"} onClick={() => setSheet("location")} />

      <div className="section-title">Preferences</div>
      <ToggleRow icon={Bell}         label="Push notifications"  checked={toggles.notifications}  onToggle={() => flip("notifications")} />
      <ToggleRow icon={Handshake}    label="Trade offer alerts"  checked={toggles.tradeAlerts}    onToggle={() => flip("tradeAlerts")} />
      <ToggleRow icon={Users}        label="Public profile"      checked={toggles.publicProfile}  onToggle={() => flip("publicProfile")} />
      <ToggleRow icon={SettingsIcon} label="Dark mode"           checked={darkMode}       onToggle={onToggleDarkMode} />

      <div className="section-title">Support</div>
      <MenuRow icon={MessageCircle} label="Help & support"      onClick={() => setSheet("help")} />
      <MenuRow icon={Flag}          label="Report a problem"    onClick={() => setSheet("report")} />
      <MenuRow icon={Info}          label="About Point Maker"  onClick={() => setSheet("about")} />
      <MenuRow icon={Lock}          label="Privacy policy"      onClick={() => setSheet("privacy")} />

      <div style={{ padding: "16px" }}>
        <button className="kt-btn ghost" disabled={loggingOut} style={{ color: "#ef4444", borderColor: "#fecaca", opacity: loggingOut ? 0.6 : 1 }} onClick={handleLogout}>
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>

      {sheet === "profile"  && <EditProfileSheet  onClose={() => setSheet(null)} currentUser={currentUser} onProfileUpdate={onProfileUpdate} />}
      {sheet === "phone"    && <PhoneNumberSheet  onClose={() => setSheet(null)} currentUser={currentUser} onProfileUpdate={onProfileUpdate} />}
      {sheet === "location" && <UpdateLocationSheet currentLocation={userLocation} onSave={(loc) => { onUpdateLocation(loc); setSheet(null); }} onClose={() => setSheet(null)} />}
      {sheet === "help"     && <HelpSheet         onClose={() => setSheet(null)} />}
      {sheet === "report"   && <ReportProblemSheet onClose={() => setSheet(null)} />}
      {sheet === "about"    && <AboutSheet        onClose={() => setSheet(null)} />}
      {sheet === "privacy"  && <PrivacySheet      onClose={() => setSheet(null)} />}
    </div>
  );
}

