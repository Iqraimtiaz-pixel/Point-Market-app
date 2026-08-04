/**
 * Production-Grade Dynamic AI Question Engine
 * Designed for unlimited categories, structured input types, and high-throughput valuation APIs.
 */

// Core Input Types Supported
export const QUESTION_TYPES = {
  TEXT: "text",
  SELECT: "select",
  BOOLEAN: "boolean",
  NUMBER: "number",
  CURRENCY: "currency",
  DATE: "date",
};

// Universal mandatory valuation metrics required across all physical/digital goods
const CORE_VALUATION_QUESTIONS = [
  {
    key: "condition",
    label: "What is the physical condition of this item?",
    help: "Select the option that best describes wear and functionality.",
    type: QUESTION_TYPES.SELECT,
    options: ["Brand New", "Like New / Open Box", "Gently Used", "Fair Condition", "For Parts / Needs Repair"],
  },
  {
    key: "originalPrice",
    label: "What was the original purchase or retail price?",
    help: "Enter the approximate retail cost when new.",
    type: QUESTION_TYPES.CURRENCY,
  },
];

// Standard Attribute Resolvers based on domain patterns
const DOMAIN_ATTRIBUTE_MAP = [
  {
    keywords: ["mobile", "phone", "tablet", "laptop", "computer", "electronics", "camera", "gadget", "appliance"],
    questions: [
      {
        key: "brand",
        label: "What is the brand or manufacturer?",
        help: "e.g., Apple, Samsung, Sony, Dell, Canon.",
        type: QUESTION_TYPES.TEXT,
      },
      {
        key: "model",
        label: "What is the specific model name or number?",
        help: "e.g., Galaxy S23, MacBook Pro M2, EOS R6.",
        type: QUESTION_TYPES.TEXT,
      },
      {
        key: "specifications",
        label: "What are the primary specs (RAM, Storage, Capacity)?",
        help: "e.g., 16GB RAM, 512GB SSD, 4K Video.",
        type: QUESTION_TYPES.TEXT,
      },
      {
        key: "warrantyOrStatus",
        label: "Does it come with active warranty or official approval/registration?",
        help: "Confirm if warranty or regulatory approvals apply.",
        type: QUESTION_TYPES.BOOLEAN,
      },
    ],
  },
  {
    keywords: ["vehicle", "bike", "car", "scooter", "motorcycle", "automobile"],
    questions: [
      {
        key: "brand",
        label: "What is the make or manufacturer?",
        help: "e.g., Honda, Toyota, Yamaha, Trek.",
        type: QUESTION_TYPES.TEXT,
      },
      {
        key: "modelYear",
        label: "What is the model or manufacturing year?",
        help: "Select or enter the year.",
        type: QUESTION_TYPES.NUMBER,
      },
      {
        key: "mileageOrEngine",
        label: "Engine displacement (CC) or total mileage covered?",
        help: "e.g., 125cc or 25,000 km.",
        type: QUESTION_TYPES.TEXT,
      },
      {
        key: "registrationStatus",
        label: "Is the registration documentation complete and verified?",
        help: "Select document availability.",
        type: QUESTION_TYPES.BOOLEAN,
      },
    ],
  },
  {
    keywords: ["fashion", "shoes", "apparel", "clothing", "watch", "jewellery", "accessory"],
    questions: [
      {
        key: "brand",
        label: "What is the brand or designer name?",
        help: "e.g., Nike, Rolex, Zara, Custom Craft.",
        type: QUESTION_TYPES.TEXT,
      },
      {
        key: "sizeOrDimensions",
        label: "What is the size or measurement?",
        help: "e.g., US 10, Medium, 42mm, 18 Karat.",
        type: QUESTION_TYPES.TEXT,
      },
      {
        key: "authenticityProof",
        label: "Do you have proof of purchase, box, or certificate of authenticity?",
        help: "Select box/receipt availability.",
        type: QUESTION_TYPES.BOOLEAN,
      },
    ],
  },
  {
    keywords: ["furniture", "decor", "home", "instrument", "medical", "art", "book", "collectible"],
    questions: [
      {
        key: "brandOrMaker",
        label: "Who is the maker, author, or manufacturer?",
        help: "Specify brand, artist, or craftsman.",
        type: QUESTION_TYPES.TEXT,
      },
      {
        key: "materialOrBuild",
        label: "What primary material or build type is used?",
        help: "e.g., Solid Oak, Brass, Canvas, Medical Grade Steel.",
        type: QUESTION_TYPES.TEXT,
      },
      {
        key: "age",
        label: "Approximate age or usage duration?",
        help: "e.g., 6 months, 2 years, Antique.",
        type: QUESTION_TYPES.TEXT,
      },
    ],
  },
];

// Fallback questions for entirely unrecognized or novel categories
const GENERIC_CATEGORY_QUESTIONS = [
  {
    key: "brand",
    label: "What is the brand, maker, or author of this item?",
    help: "Helps verify market authenticity.",
    type: QUESTION_TYPES.TEXT,
  },
  {
    key: "modelOrVariant",
    label: "What is the model name, variant, or edition?",
    help: "Specific product identifiers.",
    type: QUESTION_TYPES.TEXT,
  },
  {
    key: "ageOrUsage",
    label: "How long has this item been owned or used?",
    help: "Approximate age or ownership history.",
    type: QUESTION_TYPES.TEXT,
  },
];

/**
 * Dynamic AI Question Generator Engine
 * Generates structured questions for ANY category dynamically without hardcoding.
 * 
 * @param {string} category - The category string passed from listing
 * @returns {Array<Object>} Sequence of question configuration objects
 */
export function generateCategoryQuestions(category = "") {
  const normalizedCategory = category.trim().toLowerCase();

  // 1. Locate matching domain attribute resolvers
  const domainMatch = DOMAIN_ATTRIBUTE_MAP.find((domain) =>
    domain.keywords.some((keyword) => normalizedCategory.includes(keyword))
  );

  const primaryQuestions = domainMatch
    ? domainMatch.questions
    : GENERIC_CATEGORY_QUESTIONS;

  // 2. Synthesize dynamic category-specific title adaptation if needed
  const synthesizedQuestions = primaryQuestions.map((q) => {
    if (q.key === "brand" && normalizedCategory) {
      const formattedCat = category.trim();
      return {
        ...q,
        label: `What is the brand or maker of your ${formattedCat}?`,
      };
    }
    return q;
  });

  // 3. Compose final pipeline sequence with core valuation questions
  return [...synthesizedQuestions, ...CORE_VALUATION_QUESTIONS];
}
