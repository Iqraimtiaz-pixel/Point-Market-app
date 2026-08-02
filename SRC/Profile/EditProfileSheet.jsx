// ── Extracted from App.jsx: EditProfileSheet ──
import React, { useState, useRef } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Camera
} from "lucide-react";
import { updateUserProfile } from "../services/userService";
import { cldUpload } from "../services/cloudinaryService";

export function EditProfileSheet({ onClose, currentUser, onProfileUpdate }) {
  const [name, setName] = useState(currentUser?.username || currentUser?.fullName || "@you.trades");
  const [bio,  setBio]  = useState(currentUser?.bio || "Trading my way across town, one fair deal at a time 🤝");
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [picErr, setPicErr] = useState(null);
  const fileInputRef = useRef(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);

  const pickPicture = () => fileInputRef.current?.click();
  const handlePictureSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file again later
    if (!file || !currentUser?.uid) return;
    setPicErr(null);
    setUploadingPic(true);
    try {
      const result = await cldUpload(file, "avatars", currentUser.uid);
      setAvatarUrl(result.secure_url);
    } catch (err) {
      console.warn("Profile picture upload failed:", err?.message || err);
      setPicErr("Could not upload your photo. Please try again.");
    } finally {
      setUploadingPic(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveErr(null);
    if (!currentUser?.uid) {
      setSaving(false);
      setSaveErr("You must be signed in to update your profile.");
      return;
    }
    try {
      const updates = { username: name, bio, avatarUrl: avatarUrl || null };
      await updateUserProfile(currentUser.uid, updates);
      // Only merge into local state and show success AFTER the Firestore
      // write has actually succeeded — previously this ran even when the
      // write failed, since the catch block only logged the error and
      // execution still fell through to setDone(true) below.
      onProfileUpdate?.(updates);
      setSaving(false);
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      console.warn("Failed to save profile:", e);
      setSaving(false);
      setSaveErr(e?.code === "permission-denied"
        ? "Could not save — your account doesn't have permission to update this field yet. Please contact support."
        : "Could not save your changes. Please check your connection and try again.");
    }
  };

  const fallbackAvatar = currentUser?.avatarEmoji || "🧑";

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Edit Profile</h3>
        <p className="sheet-sub">Update how other traders see you.</p>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div
            onClick={pickPicture}
            style={{ position: "relative", width: 84, height: 84, borderRadius: 999, background: "var(--sea-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, overflow: "hidden", cursor: "pointer" }}
          >
            {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span>{fallbackAvatar}</span>}
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 999, background: "var(--sea)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--bg)" }}>
              <Camera size={13} />
            </div>
          </div>
          <button type="button" className="kt-btn ghost" onClick={pickPicture} disabled={uploadingPic}>
            <Camera size={15} /> {uploadingPic ? "Uploading…" : "Change photo"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePictureSelected} />
        </div>
        {picErr && <div className="upload-error" style={{ marginBottom: 12 }}><AlertTriangle size={13} /> {picErr}</div>}

        <label className="field-label">Username</label>
        <input className="field-input" style={{ marginBottom: 14 }} value={name} onChange={(e) => setName(e.target.value)} />
        <label className="field-label">Bio</label>
        <textarea className="field-textarea" style={{ marginBottom: 16 }} value={bio} onChange={(e) => setBio(e.target.value)} />
        {saveErr && <div className="upload-error" style={{ marginBottom: 12 }}><AlertTriangle size={13} /> {saveErr}</div>}
        {!done ? <button className="kt-btn" onClick={save} disabled={saving || uploadingPic}><CheckCircle2 size={16} /> {saving ? "Saving…" : "Save changes"}</button>
               : <div className="success-box"><CheckCircle2 size={18} /> Profile updated!</div>}
      </div>
    </div>
  );
}

