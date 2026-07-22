// =============================================================================
//  marketplace.js  ·  Point Market — Complete Marketplace System
//  src/marketplace.js
//
//  Covers:
//    1. Product Listings   (physical items for trade/sale)
//    2. Skill Listings     (services, lessons, expertise)
//    3. CRUD operations    (create, read, update, delete)
//    4. Search & filters   (full-text prefix, category, city, distance)
//    5. Categories system  (hierarchical, extensible)
//    6. User profile link  (PM Space integration)
//    7. Pagination         (cursor-based, scalable to millions)
//    8. Real-time feeds    (onSnapshot for live updates)
//
//  Never import firebase directly in UI components — use only this file.
//  Never import pointsEngine here — points are awarded by the calling UI
//  after a successful marketplace operation (separation of concerns).
// =============================================================================

import { db } from "../firebase";
import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  startAt,
  endAt,
  collection,
  collectionGroup,
  serverTimestamp,
  increment,
  onSnapshot,
  writeBatch,
  arrayUnion,
  arrayRemove,
  GeoPoint,
} from "firebase/firestore";

// =============================================================================
//  COLLECTION NAMES
// =============================================================================

export const MARKET_COL = {
  USERS:           "users",
  PRODUCTS:        "product_listings",
  SKILLS:          "skill_listings",
  CATEGORIES:      "categories",
  SAVED:           "saved_listings",   // sub-collection under users/{uid}/saved_listings
  REVIEWS:         "listing_reviews",  // sub-collection under listings
  REPORTS:         "listing_reports",
  SEARCH_INDEX:    "search_index",     // denormalized keyword index for search
};

// =============================================================================
//  CATEGORIES SYSTEM
//  Hierarchical: parent → children. Add new categories here and in Firestore.
//  Never hard-code category strings in UI — always reference these keys.
// =============================================================================

export const CATEGORIES = {
  // ── Physical Products ──────────────────────────────────────────────────────
  electronics: {
    label:    "Electronics",
    emoji:    "📱",
    type:     "product",
    children: {
      mobile_phones:   { label: "Mobile Phones",   emoji: "📱" },
      laptops:         { label: "Laptops",          emoji: "💻" },
      tablets:         { label: "Tablets",          emoji: "📲" },
      accessories:     { label: "Accessories",      emoji: "🎧" },
      cameras:         { label: "Cameras",          emoji: "📷" },
      gaming:          { label: "Gaming",           emoji: "🎮" },
      appliances:      { label: "Appliances",       emoji: "🏠" },
    },
  },
  fashion: {
    label:    "Fashion",
    emoji:    "👗",
    type:     "product",
    children: {
      mens_clothing:   { label: "Men's Clothing",   emoji: "👔" },
      womens_clothing: { label: "Women's Clothing", emoji: "👗" },
      shoes:           { label: "Shoes",            emoji: "👟" },
      bags:            { label: "Bags & Accessories", emoji: "👜" },
      watches:         { label: "Watches",          emoji: "⌚" },
      jewellery:       { label: "Jewellery",        emoji: "💍" },
    },
  },
  furniture: {
    label:    "Furniture",
    emoji:    "🛋️",
    type:     "product",
    children: {
      sofas:           { label: "Sofas & Chairs",   emoji: "🛋️" },
      beds:            { label: "Beds & Mattresses", emoji: "🛏️" },
      tables:          { label: "Tables & Desks",   emoji: "🪑" },
      storage:         { label: "Storage",          emoji: "📦" },
    },
  },
  vehicles: {
    label:    "Vehicles",
    emoji:    "🚗",
    type:     "product",
    children: {
      cars:            { label: "Cars",             emoji: "🚗" },
      motorcycles:     { label: "Motorcycles",      emoji: "🏍️" },
      bicycles:        { label: "Bicycles",         emoji: "🚲" },
      parts:           { label: "Parts & Spares",   emoji: "🔧" },
    },
  },
  books: {
    label:    "Books & Education",
    emoji:    "📚",
    type:     "product",
    children: {
      textbooks:       { label: "Textbooks",        emoji: "📖" },
      fiction:         { label: "Fiction & Novels", emoji: "📕" },
      stationary:      { label: "Stationery",       emoji: "✏️" },
    },
  },
  sports: {
    label:    "Sports & Fitness",
    emoji:    "⚽",
    type:     "product",
    children: {
      equipment:       { label: "Equipment",        emoji: "🏋️" },
      outdoor:         { label: "Outdoor & Camping", emoji: "⛺" },
      fitness:         { label: "Fitness",          emoji: "🏃" },
    },
  },

  // ── Skills & Services ──────────────────────────────────────────────────────
  tech_skills: {
    label:    "Tech Skills",
    emoji:    "💻",
    type:     "skill",
    children: {
      web_dev:         { label: "Web Development",  emoji: "🌐" },
      app_dev:         { label: "App Development",  emoji: "📱" },
      graphic_design:  { label: "Graphic Design",   emoji: "🎨" },
      video_editing:   { label: "Video Editing",    emoji: "🎬" },
      seo:             { label: "SEO & Marketing",  emoji: "📈" },
      data_entry:      { label: "Data Entry",       emoji: "⌨️" },
    },
  },
  education: {
    label:    "Education & Tutoring",
    emoji:    "🎓",
    type:     "skill",
    children: {
      tutoring:        { label: "Tutoring",         emoji: "📝" },
      languages:       { label: "Languages",        emoji: "🗣️" },
      music:           { label: "Music Lessons",    emoji: "🎵" },
      quran:           { label: "Quran & Islamic Studies", emoji: "🕌" },
      art_crafts:      { label: "Art & Crafts",     emoji: "🎨" },
    },
  },
  home_services: {
    label:    "Home Services",
    emoji:    "🏠",
    type:     "skill",
    children: {
      plumbing:        { label: "Plumbing",         emoji: "🔧" },
      electrical:      { label: "Electrical",       emoji: "⚡" },
      cleaning:        { label: "Cleaning",         emoji: "🧹" },
      painting:        { label: "Painting",         emoji: "🖌️" },
      tailoring:       { label: "Tailoring",        emoji: "🪡" },
    },
  },
  health: {
    label:    "Health & Wellness",
    emoji:    "💊",
    type:     "skill",
    children: {
      fitness_training:{ label: "Fitness Training", emoji: "💪" },
      nutrition:       { label: "Nutrition & Diet", emoji: "🥗" },
      yoga:            { label: "Yoga & Meditation", emoji: "🧘" },
    },
  },
  business: {
    label:    "Business & Finance",
    emoji:    "💼",
    type:     "skill",
    children: {
      accounting:      { label: "Accounting",       emoji: "📊" },
      legal:           { label: "Legal Advice",     emoji: "⚖️" },
      consulting:      { label: "Consulting",       emoji: "🤝" },
    },
  },
};

/** Flat list of all categories for dropdowns */
export function getAllCategories(type = null) {
  return Object.entries(CATEGORIES)
    .filter(([, v]) => !type || v.type === type)
    .map(([key, v]) => ({
      key,
      label:    v.label,
      emoji:    v.emoji,
      type:     v.type,
      children: Object.entries(v.children || {}).map(([ck, cv]) => ({
        key: `${key}.${ck}`,
        label: cv.label,
        emoji: cv.emoji,
      })),
    }));
}

/** Resolve a category key ("electronics.mobile_phones") to its label */
export function getCategoryLabel(key) {
  if (!key) return "";
  const [parent, child] = key.split(".");
  const p = CATEGORIES[parent];
  if (!p) return key;
  if (!child) return p.label;
  return p.children?.[child]?.label || key;
}

// =============================================================================
//  CONDITION VALUES (for products)
// =============================================================================

export const CONDITION = {
  NEW:         { key: "new",         label: "Brand New",        emoji: "✨" },
  LIKE_NEW:    { key: "like_new",    label: "Like New",         emoji: "💎" },
  GOOD:        { key: "good",        label: "Good",             emoji: "👍" },
  FAIR:        { key: "fair",        label: "Fair",             emoji: "🙂" },
  FOR_PARTS:   { key: "for_parts",   label: "For Parts / Repair", emoji: "🔧" },
};

// =============================================================================
//  LISTING STATUS
// =============================================================================

export const LISTING_STATUS = {
  ACTIVE:      "active",
  PAUSED:      "paused",      // owner hid it temporarily
  SOLD:        "sold",        // trade completed
  REMOVED:     "removed",     // admin removed
  DRAFT:       "draft",       // saved but not published
};

// =============================================================================
//  HELPERS
// =============================================================================

/** Build a keyword array from a listing for search indexing */
function buildKeywords(title, description, category) {
  const text = `${title} ${description} ${getCategoryLabel(category)}`.toLowerCase();
  const words = text.split(/\W+/).filter((w) => w.length >= 2);
  const prefixes = [];
  for (const word of words) {
    for (let i = 2; i <= Math.min(word.length, 15); i++) {
      prefixes.push(word.slice(0, i));
    }
  }
  return [...new Set([...words, ...prefixes])].slice(0, 100); // Firestore array limit
}

/** Haversine distance in KM (duplicated here for independence from main app) */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// =============================================================================
//  PRODUCT LISTINGS — CREATE
// =============================================================================

/**
 * Create a new product listing.
 * @param {string} uid  — owner's Firebase UID
 * @param {object} data
 *   title, description, category, subcategory, condition,
 *   needsInReturn, tradeForPm, pmAskingPrice,
 *   city, lat, lng,
 *   mediaUrl, mediaType, thumbnailUrl,
 *   aiKarmaScore, recommendedPm, aiBadges
 * @returns {string} listingId
 */
export async function createProductListing(uid, data) {
  _validateProductData(data);

  const keywords = buildKeywords(data.title, data.description || "", data.category || "");

  const ref = await addDoc(collection(db, MARKET_COL.PRODUCTS), {
    uid,
    listingType:     "product",
    title:           data.title.trim(),
    titleLower:      data.title.trim().toLowerCase(),
    description:     (data.description || "").trim(),
    category:        data.category     || "",
    subcategory:     data.subcategory  || "",
    condition:       data.condition    || CONDITION.GOOD.key,
    needsInReturn:   (data.needsInReturn || "").trim(),
    tradeForPm:      !!data.tradeForPm,         // accept PM Points instead of item
    pmAskingPrice:   data.pmAskingPrice   || 0,
    city:            data.city            || "",
    location:        data.lat && data.lng
                       ? new GeoPoint(data.lat, data.lng)
                       : null,
    lat:             data.lat             || null,
    lng:             data.lng             || null,
    mediaUrl:        data.mediaUrl        || null,
    mediaType:       data.mediaType       || null,
    thumbnailUrl:    data.thumbnailUrl    || null,
    aiKarmaScore:    data.aiKarmaScore    || 0,
    recommendedPm:   data.recommendedPm   || 0,
    aiBadges:        data.aiBadges        || [],
    keywords,
    likes:           0,
    views:           0,
    saves:           0,
    tradeRequests:   0,
    status:          data.draft ? LISTING_STATUS.DRAFT : LISTING_STATUS.ACTIVE,
    isBoosted:       false,
    boostExpiresAt:  null,
    isRemoved:       false,
    createdAt:       serverTimestamp(),
    updatedAt:       serverTimestamp(),
  });

  // Update user's listing count
  await updateDoc(doc(db, MARKET_COL.USERS, uid), {
    productListingCount: increment(1),
    lastActiveAt:        serverTimestamp(),
  });

  return ref.id;
}

function _validateProductData(data) {
  if (!data.title || data.title.trim().length < 3) {
    throw new Error("Title must be at least 3 characters.");
  }
  if (data.title.trim().length > 100) {
    throw new Error("Title must be 100 characters or less.");
  }
  if (data.description && data.description.length > 2000) {
    throw new Error("Description must be 2000 characters or less.");
  }
  if (data.pmAskingPrice && data.pmAskingPrice < 0) {
    throw new Error("PM asking price cannot be negative.");
  }
}

// =============================================================================
//  SKILL LISTINGS — CREATE
// =============================================================================

/**
 * Create a new skill/service listing.
 * @param {string} uid
 * @param {object} data
 *   title, description, category, subcategory,
 *   skillLevel (beginner|intermediate|expert),
 *   deliveryMode (online|in_person|both),
 *   sessionDuration (minutes),
 *   pmPricePerSession,
 *   city, lat, lng,
 *   mediaUrl, thumbnailUrl,
 *   aiKarmaScore, recommendedPm, aiBadges,
 *   portfolio [] (urls)
 * @returns {string} listingId
 */
export async function createSkillListing(uid, data) {
  _validateSkillData(data);

  const keywords = buildKeywords(data.title, data.description || "", data.category || "");

  const ref = await addDoc(collection(db, MARKET_COL.SKILLS), {
    uid,
    listingType:        "skill",
    title:              data.title.trim(),
    titleLower:         data.title.trim().toLowerCase(),
    description:        (data.description || "").trim(),
    category:           data.category          || "",
    subcategory:        data.subcategory        || "",
    skillLevel:         data.skillLevel         || "intermediate",
    deliveryMode:       data.deliveryMode       || "both",
    sessionDurationMin: data.sessionDuration    || 60,
    pmPricePerSession:  data.pmPricePerSession  || 0,
    barter:             !!data.barter,           // willing to barter for items
    needsInReturn:      (data.needsInReturn || "").trim(),
    city:               data.city               || "",
    location:           data.lat && data.lng
                          ? new GeoPoint(data.lat, data.lng)
                          : null,
    lat:                data.lat                || null,
    lng:                data.lng                || null,
    mediaUrl:           data.mediaUrl           || null,
    thumbnailUrl:       data.thumbnailUrl        || null,
    portfolio:          data.portfolio           || [],
    aiKarmaScore:       data.aiKarmaScore        || 0,
    recommendedPm:      data.recommendedPm       || 0,
    aiBadges:           data.aiBadges            || [],
    keywords,
    likes:              0,
    views:              0,
    saves:              0,
    bookings:           0,
    rating:             0,
    ratingCount:        0,
    status:             data.draft ? LISTING_STATUS.DRAFT : LISTING_STATUS.ACTIVE,
    isBoosted:          false,
    boostExpiresAt:     null,
    isRemoved:          false,
    createdAt:          serverTimestamp(),
    updatedAt:          serverTimestamp(),
  });

  await updateDoc(doc(db, MARKET_COL.USERS, uid), {
    skillListingCount: increment(1),
    lastActiveAt:      serverTimestamp(),
  });

  return ref.id;
}

function _validateSkillData(data) {
  if (!data.title || data.title.trim().length < 3) {
    throw new Error("Title must be at least 3 characters.");
  }
  if (data.pmPricePerSession && data.pmPricePerSession < 0) {
    throw new Error("PM price per session cannot be negative.");
  }
  if (data.sessionDuration && (data.sessionDuration < 15 || data.sessionDuration > 480)) {
    throw new Error("Session duration must be between 15 and 480 minutes.");
  }
}

// =============================================================================
//  EDIT LISTINGS
// =============================================================================

/**
 * Update a product listing. Only the owner can update.
 * Ownership verified server-side by security rules — this just does the write.
 */
export async function updateProductListing(listingId, uid, updates) {
  const allowedFields = [
    "title", "titleLower", "description", "category", "subcategory",
    "condition", "needsInReturn", "tradeForPm", "pmAskingPrice",
    "city", "lat", "lng", "location",
    "mediaUrl", "mediaType", "thumbnailUrl",
    "aiKarmaScore", "recommendedPm", "aiBadges",
    "status", "keywords",
  ];

  const cleaned = {};
  for (const key of allowedFields) {
    if (key in updates) cleaned[key] = updates[key];
  }

  if (updates.title) {
    cleaned.titleLower = updates.title.toLowerCase();
    cleaned.keywords   = buildKeywords(
      updates.title,
      updates.description || "",
      updates.category    || ""
    );
  }

  await updateDoc(doc(db, MARKET_COL.PRODUCTS, listingId), {
    ...cleaned,
    updatedAt: serverTimestamp(),
  });
}

export async function updateSkillListing(listingId, uid, updates) {
  const allowedFields = [
    "title", "titleLower", "description", "category", "subcategory",
    "skillLevel", "deliveryMode", "sessionDurationMin", "pmPricePerSession",
    "barter", "needsInReturn", "city", "lat", "lng", "location",
    "mediaUrl", "thumbnailUrl", "portfolio",
    "aiKarmaScore", "recommendedPm", "aiBadges",
    "status", "keywords",
  ];

  const cleaned = {};
  for (const key of allowedFields) {
    if (key in updates) cleaned[key] = updates[key];
  }

  if (updates.title) {
    cleaned.titleLower = updates.title.toLowerCase();
    cleaned.keywords   = buildKeywords(
      updates.title,
      updates.description || "",
      updates.category    || ""
    );
  }

  await updateDoc(doc(db, MARKET_COL.SKILLS, listingId), {
    ...cleaned,
    updatedAt: serverTimestamp(),
  });
}

// =============================================================================
//  PAUSE / UNPAUSE (soft status toggle — owner control)
// =============================================================================

export async function pauseListing(col, listingId) {
  await updateDoc(doc(db, col, listingId), {
    status:    LISTING_STATUS.PAUSED,
    updatedAt: serverTimestamp(),
  });
}

export async function resumeListing(col, listingId) {
  await updateDoc(doc(db, col, listingId), {
    status:    LISTING_STATUS.ACTIVE,
    updatedAt: serverTimestamp(),
  });
}

export async function markAsSold(listingId) {
  await updateDoc(doc(db, MARKET_COL.PRODUCTS, listingId), {
    status:    LISTING_STATUS.SOLD,
    soldAt:    serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// =============================================================================
//  DELETE LISTING  (soft delete — never hard delete)
// =============================================================================

export async function deleteProductListing(listingId, uid) {
  const batch = writeBatch(db);
  batch.update(doc(db, MARKET_COL.PRODUCTS, listingId), {
    status:    LISTING_STATUS.REMOVED,
    isRemoved: true,
    removedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, MARKET_COL.USERS, uid), {
    productListingCount: increment(-1),
  });
  await batch.commit();
}

export async function deleteSkillListing(listingId, uid) {
  const batch = writeBatch(db);
  batch.update(doc(db, MARKET_COL.SKILLS, listingId), {
    status:    LISTING_STATUS.REMOVED,
    isRemoved: true,
    removedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, MARKET_COL.USERS, uid), {
    skillListingCount: increment(-1),
  });
  await batch.commit();
}

// Admin hard-remove (still sets isRemoved rather than deleting the document)
export async function adminRemoveListing(colName, listingId, adminUid) {
  await updateDoc(doc(db, colName, listingId), {
    status:      LISTING_STATUS.REMOVED,
    isRemoved:   true,
    removedBy:   adminUid,
    removedAt:   serverTimestamp(),
    updatedAt:   serverTimestamp(),
  });
}

// =============================================================================
//  READ — SINGLE LISTING
// =============================================================================

export async function getProductListing(listingId) {
  const snap = await getDoc(doc(db, MARKET_COL.PRODUCTS, listingId));
  if (!snap.exists() || snap.data().isRemoved) return null;
  // Increment view count (fire-and-forget)
  updateDoc(snap.ref, { views: increment(1) }).catch(() => {});
  return { id: snap.id, ...snap.data() };
}

export async function getSkillListing(listingId) {
  const snap = await getDoc(doc(db, MARKET_COL.SKILLS, listingId));
  if (!snap.exists() || snap.data().isRemoved) return null;
  updateDoc(snap.ref, { views: increment(1) }).catch(() => {});
  return { id: snap.id, ...snap.data() };
}

// =============================================================================
//  READ — PAGINATED FEEDS
// =============================================================================

/**
 * Main home feed — both products and skills, newest first.
 * For millions of users, Firestore cursor pagination means this is O(1)
 * regardless of total document count.
 */
export async function getMainFeed(pageSize = 10, lastDoc = null) {
  return _paginatedQuery(MARKET_COL.PRODUCTS, [
    where("status",    "==", LISTING_STATUS.ACTIVE),
    where("isRemoved", "==", false),
    orderBy("isBoosted", "desc"),   // boosted posts appear first
    orderBy("createdAt", "desc"),
  ], pageSize, lastDoc);
}

export async function getProductFeed(pageSize = 10, lastDoc = null) {
  return _paginatedQuery(MARKET_COL.PRODUCTS, [
    where("status",    "==", LISTING_STATUS.ACTIVE),
    where("isRemoved", "==", false),
    orderBy("isBoosted", "desc"),
    orderBy("createdAt", "desc"),
  ], pageSize, lastDoc);
}

export async function getSkillFeed(pageSize = 10, lastDoc = null) {
  return _paginatedQuery(MARKET_COL.SKILLS, [
    where("status",    "==", LISTING_STATUS.ACTIVE),
    where("isRemoved", "==", false),
    orderBy("isBoosted", "desc"),
    orderBy("createdAt", "desc"),
  ], pageSize, lastDoc);
}

// =============================================================================
//  SEARCH  (prefix-based keyword search — works in Firestore without Algolia)
// =============================================================================

/**
 * Full-text search across product or skill listings using the pre-built keywords array.
 * Prefix search: typing "lap" returns "laptop", "laps", etc.
 * For production at scale, replace with Algolia or Typesense (fire-and-forget
 * index sync from Cloud Functions) — the keywords field stays as a fallback.
 *
 * @param {string} queryStr        — raw search input from user
 * @param {'product'|'skill'|'all'} type
 * @param {object} filters
 * @param {number} pageSize
 * @param {DocumentSnapshot} lastDoc
 */
export async function searchListings(queryStr, type = "all", filters = {}, pageSize = 10, lastDoc = null) {
  const q = queryStr.trim().toLowerCase();
  if (!q) return { listings: [], lastDoc: null, hasMore: false };

  const results = [];
  const collections = type === "product" ? [MARKET_COL.PRODUCTS]
                    : type === "skill"   ? [MARKET_COL.SKILLS]
                    : [MARKET_COL.PRODUCTS, MARKET_COL.SKILLS];

  for (const colName of collections) {
    const constraints = [
      where("keywords",  "array-contains", q),
      where("status",    "==", LISTING_STATUS.ACTIVE),
      where("isRemoved", "==", false),
    ];

    if (filters.category) {
      constraints.push(where("category", "==", filters.category));
    }
    if (filters.subcategory) {
      constraints.push(where("subcategory", "==", filters.subcategory));
    }
    if (filters.city) {
      constraints.push(where("city", "==", filters.city));
    }

    constraints.push(orderBy("createdAt", "desc"), limit(pageSize));

    let qRef = query(collection(db, colName), ...constraints);
    if (lastDoc) qRef = query(qRef, startAfter(lastDoc));

    const snap = await getDocs(qRef);
    results.push(...snap.docs.map((d) => ({ id: d.id, _col: colName, ...d.data() })));
  }

  // Apply client-side distance filter if GPS provided
  if (filters.lat && filters.lng && filters.maxKm) {
    return {
      listings: results.filter((l) => {
        if (!l.lat || !l.lng) return filters.city ? l.city === filters.city : true;
        return haversineKm(filters.lat, filters.lng, l.lat, l.lng) <= filters.maxKm;
      }),
      lastDoc:  null,
      hasMore:  false,
    };
  }

  return {
    listings: results.slice(0, pageSize),
    lastDoc:  null,
    hasMore:  results.length >= pageSize,
  };
}

// =============================================================================
//  FILTERS
// =============================================================================

/**
 * Filter product listings by category, city, condition, PM price range.
 */
export async function filterProducts(filters = {}, pageSize = 10, lastDoc = null) {
  const constraints = [
    where("status",    "==", LISTING_STATUS.ACTIVE),
    where("isRemoved", "==", false),
  ];

  if (filters.category)     constraints.push(where("category",   "==", filters.category));
  if (filters.subcategory)  constraints.push(where("subcategory","==", filters.subcategory));
  if (filters.city)         constraints.push(where("city",       "==", filters.city));
  if (filters.condition)    constraints.push(where("condition",  "==", filters.condition));
  if (filters.tradeForPm)   constraints.push(where("tradeForPm", "==", true));

  // Sort options
  const sortField = filters.sortBy === "price"  ? "pmAskingPrice"
                  : filters.sortBy === "popular" ? "likes"
                  : "createdAt";
  const sortDir = filters.sortDir === "asc" ? "asc" : "desc";
  constraints.push(orderBy(sortField, sortDir), limit(pageSize));

  const result = await _paginatedQuery(MARKET_COL.PRODUCTS, constraints, pageSize, lastDoc);

  // Apply distance post-filter if GPS provided
  if (filters.lat && filters.lng && filters.maxKm) {
    result.listings = result.listings.filter((l) => {
      if (!l.lat || !l.lng) return l.city === filters.city;
      return haversineKm(filters.lat, filters.lng, l.lat, l.lng) <= filters.maxKm;
    });
  }

  // PM price range post-filter
  if (filters.pmMin != null) {
    result.listings = result.listings.filter((l) => (l.pmAskingPrice || 0) >= filters.pmMin);
  }
  if (filters.pmMax != null) {
    result.listings = result.listings.filter((l) => (l.pmAskingPrice || 0) <= filters.pmMax);
  }

  return result;
}

/**
 * Filter skill listings by category, city, delivery mode, skill level.
 */
export async function filterSkills(filters = {}, pageSize = 10, lastDoc = null) {
  const constraints = [
    where("status",    "==", LISTING_STATUS.ACTIVE),
    where("isRemoved", "==", false),
  ];

  if (filters.category)     constraints.push(where("category",      "==", filters.category));
  if (filters.subcategory)  constraints.push(where("subcategory",   "==", filters.subcategory));
  if (filters.city)         constraints.push(where("city",          "==", filters.city));
  if (filters.deliveryMode) constraints.push(where("deliveryMode",  "==", filters.deliveryMode));
  if (filters.skillLevel)   constraints.push(where("skillLevel",    "==", filters.skillLevel));
  if (filters.barter)       constraints.push(where("barter",        "==", true));

  const sortField = filters.sortBy === "price"   ? "pmPricePerSession"
                  : filters.sortBy === "rating"  ? "rating"
                  : filters.sortBy === "popular" ? "bookings"
                  : "createdAt";
  constraints.push(orderBy(sortField, "desc"), limit(pageSize));

  return _paginatedQuery(MARKET_COL.SKILLS, constraints, pageSize, lastDoc);
}

// =============================================================================
//  LOCATION-BASED FEED  (nearby listings)
// =============================================================================

/**
 * Get listings nearest to a GPS coordinate.
 * Firestore doesn't support native geospatial queries without GeoFirestore.
 * Strategy: filter by city first (Firestore), then sort by distance in-memory.
 * For geo-query at true scale, use GeoFirestore or Algolia's geo features.
 */
export async function getNearbyListings(city, lat, lng, maxKm = 5, pageSize = 20) {
  const [products, skills] = await Promise.all([
    getDocs(query(
      collection(db, MARKET_COL.PRODUCTS),
      where("city",      "==", city),
      where("status",    "==", LISTING_STATUS.ACTIVE),
      where("isRemoved", "==", false),
      orderBy("createdAt", "desc"),
      limit(100)    // over-fetch then sort/filter in memory
    )),
    getDocs(query(
      collection(db, MARKET_COL.SKILLS),
      where("city",      "==", city),
      where("status",    "==", LISTING_STATUS.ACTIVE),
      where("isRemoved", "==", false),
      orderBy("createdAt", "desc"),
      limit(100)
    )),
  ]);

  const all = [
    ...products.docs.map((d) => ({ id: d.id, _col: MARKET_COL.PRODUCTS, ...d.data() })),
    ...skills.docs.map((d)   => ({ id: d.id, _col: MARKET_COL.SKILLS,   ...d.data() })),
  ]
  .map((l) => ({
    ...l,
    distanceKm: l.lat && l.lng ? haversineKm(lat, lng, l.lat, l.lng) : 999,
  }))
  .filter((l) => l.distanceKm <= maxKm)
  .sort((a, b) => a.distanceKm - b.distanceKm)
  .slice(0, pageSize);

  return all;
}

// =============================================================================
//  USER PROFILE LINKAGE  (PM Space / My Listings)
// =============================================================================

/**
 * Get all active listings for a user (for their PM Space profile page).
 */
export async function getUserListings(uid, type = "all", pageSize = 20, lastDoc = null) {
  const results = [];

  const cols = type === "product" ? [MARKET_COL.PRODUCTS]
             : type === "skill"   ? [MARKET_COL.SKILLS]
             : [MARKET_COL.PRODUCTS, MARKET_COL.SKILLS];

  for (const colName of cols) {
    const r = await _paginatedQuery(colName, [
      where("uid",       "==", uid),
      where("isRemoved", "==", false),
      orderBy("createdAt", "desc"),
    ], pageSize, lastDoc);
    results.push(...r.listings.map((l) => ({ ...l, _col: colName })));
  }

  return results.sort((a, b) =>
    (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
  ).slice(0, pageSize);
}

/**
 * Get a user's full PM Space profile including listing counts and stats.
 */
export async function getPmSpaceProfile(uid) {
  const userSnap = await getDoc(doc(db, MARKET_COL.USERS, uid));
  if (!userSnap.exists()) return null;
  const user = { id: userSnap.id, ...userSnap.data() };

  const [products, skills] = await Promise.all([
    getDocs(query(
      collection(db, MARKET_COL.PRODUCTS),
      where("uid", "==", uid), where("isRemoved", "==", false), limit(6)
    )),
    getDocs(query(
      collection(db, MARKET_COL.SKILLS),
      where("uid", "==", uid), where("isRemoved", "==", false), limit(6)
    )),
  ]);

  return {
    ...user,
    recentProducts: products.docs.map((d) => ({ id: d.id, ...d.data() })),
    recentSkills:   skills.docs.map((d)   => ({ id: d.id, ...d.data() })),
    productCount:   user.productListingCount || products.size,
    skillCount:     user.skillListingCount   || skills.size,
  };
}

// =============================================================================
//  SAVE / UNSAVE A LISTING  (user bookmarks)
// =============================================================================

export async function saveListing(uid, listingId, colName) {
  const savedRef = doc(db, MARKET_COL.USERS, uid, MARKET_COL.SAVED, listingId);
  await setDocIfAbsent(savedRef, {
    listingId,
    collection: colName,
    savedAt:    serverTimestamp(),
  });
  await updateDoc(doc(db, colName, listingId), { saves: increment(1) });
}

export async function unsaveListing(uid, listingId, colName) {
  await deleteDoc(doc(db, MARKET_COL.USERS, uid, MARKET_COL.SAVED, listingId));
  await updateDoc(doc(db, colName, listingId), { saves: increment(-1) });
}

export async function getSavedListings(uid) {
  const snap = await getDocs(
    query(collection(db, MARKET_COL.USERS, uid, MARKET_COL.SAVED), orderBy("savedAt", "desc"))
  );
  return snap.docs.map((d) => d.data());
}

async function setDocIfAbsent(ref, data) {
  const snap = await getDoc(ref);
  if (!snap.exists()) await setDoc(ref, data);
}

// =============================================================================
//  LIKE A LISTING
// =============================================================================

export async function toggleLike(uid, listingId, colName, isLiked) {
  const listingRef = doc(db, colName, listingId);
  const userRef    = doc(db, MARKET_COL.USERS, uid);
  if (isLiked) {
    await updateDoc(listingRef, { likes: increment(-1) });
    await updateDoc(userRef,    { likedListings: arrayRemove(listingId) });
  } else {
    await updateDoc(listingRef, { likes: increment(1) });
    await updateDoc(userRef,    { likedListings: arrayUnion(listingId) });
  }
  return !isLiked;
}

// =============================================================================
//  BOOST A LISTING
// =============================================================================

export async function boostListing(listingId, colName) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await updateDoc(doc(db, colName, listingId), {
    isBoosted:      true,
    boostExpiresAt: expiresAt,
    updatedAt:      serverTimestamp(),
  });
  return expiresAt;
}

export async function expireBoosts() {
  // Call this from a Cloud Function scheduled daily
  // to auto-expire boosts after 24 hours
  const now = new Date().toISOString();
  const expired = await getDocs(query(
    collectionGroup(db, "product_listings"),
    where("isBoosted", "==", true),
    where("boostExpiresAt", "<=", now)
  ));
  const batch = writeBatch(db);
  expired.docs.forEach((d) => {
    batch.update(d.ref, { isBoosted: false, boostExpiresAt: null });
  });
  await batch.commit();
}

// =============================================================================
//  LISTING REVIEWS  (sub-collection under each listing)
// =============================================================================

export async function addListingReview(listingId, colName, data) {
  // data: { reviewerUid, reviewerName, avatar, rating (1-5), text }
  const ref = await addDoc(
    collection(db, colName, listingId, MARKET_COL.REVIEWS), {
      ...data,
      createdAt: serverTimestamp(),
    }
  );

  // Update listing's aggregate rating
  const snap = await getDoc(doc(db, colName, listingId));
  if (snap.exists()) {
    const { rating = 0, ratingCount = 0 } = snap.data();
    const newCount  = ratingCount + 1;
    const newRating = ((rating * ratingCount) + data.rating) / newCount;
    await updateDoc(snap.ref, {
      rating:      Math.round(newRating * 10) / 10,
      ratingCount: newCount,
    });
  }
  return ref.id;
}

export async function getListingReviews(listingId, colName, pageSize = 10) {
  const snap = await getDocs(query(
    collection(db, colName, listingId, MARKET_COL.REVIEWS),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// =============================================================================
//  REPORT A LISTING
// =============================================================================

export async function reportListing(listingId, colName, data) {
  return addDoc(collection(db, MARKET_COL.REPORTS), {
    listingId,
    collection:  colName,
    reporterUid: data.reporterUid,
    reporter:    data.reporter,
    type:        data.type,      // spam | misleading | fake | inappropriate | scam
    details:     data.details    || "",
    status:      "open",
    createdAt:   serverTimestamp(),
  });
}

// =============================================================================
//  REAL-TIME LISTENERS
// =============================================================================

/** Live feed (home screen). Returns unsubscribe function. */
export function listenToFeed(callback, pageSize = 10) {
  const q = query(
    collection(db, MARKET_COL.PRODUCTS),
    where("status",    "==", LISTING_STATUS.ACTIVE),
    where("isRemoved", "==", false),
    orderBy("isBoosted", "desc"),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

/** Live updates to a single listing (for detail page). */
export function listenToListing(listingId, colName, callback) {
  return onSnapshot(doc(db, colName, listingId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
}

/** Live PM Space — user's own listings (My Listings screen). */
export function listenToUserListings(uid, colName, callback) {
  const q = query(
    collection(db, colName),
    where("uid",       "==", uid),
    where("isRemoved", "==", false),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// =============================================================================
//  ADMIN ANALYTICS
// =============================================================================

export async function getMarketplaceStats() {
  const [prodSnap, skillSnap] = await Promise.all([
    getDocs(collection(db, MARKET_COL.PRODUCTS)),
    getDocs(collection(db, MARKET_COL.SKILLS)),
  ]);

  const products = prodSnap.docs.map((d) => d.data());
  const skills   = skillSnap.docs.map((d) => d.data());

  const active   = (arr) => arr.filter((l) => l.status === LISTING_STATUS.ACTIVE);
  const byCity   = (arr) => arr.reduce((acc, l) => {
    if (l.city) acc[l.city] = (acc[l.city] || 0) + 1;
    return acc;
  }, {});
  const byCat    = (arr) => arr.reduce((acc, l) => {
    if (l.category) acc[l.category] = (acc[l.category] || 0) + 1;
    return acc;
  }, {});

  return {
    totalProducts:     products.length,
    activeProducts:    active(products).length,
    totalSkills:       skills.length,
    activeSkills:      active(skills).length,
    totalListings:     products.length + skills.length,
    activeListings:    active(products).length + active(skills).length,
    boostedListings:   [...products, ...skills].filter((l) => l.isBoosted).length,
    productsByCity:    byCity(products),
    skillsByCity:      byCity(skills),
    productsByCategory: byCat(products),
    skillsByCategory:   byCat(skills),
    mostLiked:         products.sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 5),
    mostViewed:        products.sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5),
    mostBooked:        skills.sort((a, b) => (b.bookings || 0) - (a.bookings || 0)).slice(0, 5),
  };
}

// =============================================================================
//  INTERNAL PAGINATION HELPER
// =============================================================================

async function _paginatedQuery(colName, constraints, pageSize, lastDoc) {
  let q = query(collection(db, colName), ...constraints);
  if (lastDoc) q = query(q, startAfter(lastDoc));
  const snap = await getDocs(q);
  return {
    listings: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc:  snap.docs[snap.docs.length - 1] || null,
    hasMore:  snap.docs.length === pageSize,
  };
}
