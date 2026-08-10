// ── Shared category classification, extracted from ListingsScreen.jsx's
// existing isSkillCat/isServiceCat logic so MarketplaceScreen and
// ListingsScreen never drift apart on what counts as a "skill" vs
// "product" listing. Products = everything that is neither. ──

export const isSkillCategory = (c) => (c || "").toLowerCase().includes("skill");
export const isServiceCategory = (c) => (c || "").toLowerCase().includes("service");
export const isProductCategory = (c) => !isSkillCategory(c) && !isServiceCategory(c);
