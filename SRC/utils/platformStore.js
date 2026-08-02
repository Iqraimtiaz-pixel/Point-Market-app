// ── Extracted from App.jsx: notifyStore, platformStore, removeListing, resolveReport, submitReport, submitReview, submitTransaction, suspendUser, unsuspendUser ──

export const platformStore = {
  reports: [],
  reviews: [],
  transactions: [],
  moderatedListingIds: new Set(),
  suspendedUsers: new Set(),
  listeners: new Set(),
};


export function notifyStore() { platformStore.listeners.forEach((fn) => fn()); }


export function submitReport(report) {
  platformStore.reports = [{ ...report, id: `report-${Date.now()}`, status: "open", at: new Date().toISOString() }, ...platformStore.reports];
  notifyStore();
}


export function submitReview(review) {
  platformStore.reviews = [{ ...review, id: `review-${Date.now()}`, at: new Date().toISOString() }, ...platformStore.reviews];
  notifyStore();
}


export function submitTransaction(tx) {
  platformStore.transactions = [tx, ...platformStore.transactions];
  notifyStore();
}


export function resolveReport(id, resolution) {
  platformStore.reports = platformStore.reports.map((r) => r.id === id ? { ...r, status: resolution } : r);
  notifyStore();
}


export function suspendUser(username) {
  platformStore.suspendedUsers.add(username);
  notifyStore();
}


export function unsuspendUser(username) {
  platformStore.suspendedUsers.delete(username);
  notifyStore();
}


export function removeListing(itemId) {
  platformStore.moderatedListingIds.add(itemId);
  notifyStore();
}

