// =============================================================================
//  services/cloudinaryService.js  ·  Point Market — Cloudinary Upload Service
//
//  Direct unsigned browser uploads to Cloudinary. No API secret in frontend.
//  Cloud name: dzhy4zx5g  |  Upload preset: point_market_unsigned
//
//  Setup (one-time, Cloudinary dashboard):
//    Settings → Upload → Upload presets → Add preset
//    Name: point_market_unsigned · Signing Mode: Unsigned · Folder: point_market
// =============================================================================

const CLD_CLOUD  = "dzhy4zx5g";
const CLD_PRESET = "point_market_unsigned";

/**
 * Upload a video or image file directly to Cloudinary with progress + cancellation.
 * @param {File} file
 * @param {string} folder      — subfolder under point_market/ (e.g. "listings", "boosts")
 * @param {string} uid         — Firebase Auth UID, used to namespace uploads per user
 * @param {Function} [onProgress] — (percent: number) => void
 * @param {AbortSignal} [signal]  — for cancellation
 * @returns {Promise<object>}  — raw Cloudinary response { secure_url, public_id, duration, width, height, format, bytes, ... }
 */
export function cldUpload(file, folder, uid, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const isVid = file.type.startsWith("video/");
    const maxMb = isVid ? 200 : 20;
    const maxB  = maxMb * 1024 * 1024;

    if (file.size > maxB) {
      return reject(new Error(`File too large (max ${maxMb} MB).`));
    }

    const fd = new FormData();
    fd.append("file",          file);
    fd.append("upload_preset", CLD_PRESET);
    fd.append("folder",        `point_market/${folder}/${uid}`);
    fd.append("resource_type", isVid ? "video" : "image");

    if (isVid) {
      
    }

    const resourceType = isVid ? "video" : "image";
    const url = `https://api.cloudinary.com/v1_1/${CLD_CLOUD}/${resourceType}/upload`;
    const xhr = new XMLHttpRequest();

    if (signal) {
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(Object.assign(new Error("Upload cancelled"), { name: "AbortError" }));
      });
    }

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try   { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error("Invalid Cloudinary response.")); }
      } else {
        let msg = `Upload failed (HTTP ${xhr.status}).`;
        try { msg = JSON.parse(xhr.responseText)?.error?.message || msg; } catch {}
        reject(new Error(msg));
      }
    });

    xhr.addEventListener("error",   () => reject(new Error("Network error during upload.")));
    xhr.addEventListener("timeout", () => reject(new Error("Upload timed out.")));
    xhr.timeout = 300_000; // 5 minutes
    xhr.open("POST", url);
    xhr.send(fd);
  });
}

/**
 * Build a Cloudinary thumbnail URL for a video or image public_id.
 * @param {string} publicId
 * @param {boolean} isVid
 * @returns {string|null}
 */
export function cldThumbUrl(publicId, isVid) {
  if (!publicId) return null;
  if (isVid) {
    return `https://res.cloudinary.com/${CLD_CLOUD}/video/upload/c_fill,w_400,h_400,so_0,q_auto,f_jpg/${publicId}.jpg`;
  }
  return `https://res.cloudinary.com/${CLD_CLOUD}/image/upload/c_fill,w_400,h_300,q_auto,f_webp/${publicId}`;
}

export { CLD_CLOUD, CLD_PRESET };
