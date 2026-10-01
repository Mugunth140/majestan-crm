// crm/crm-frontend/src/lib/faq-sections.ts

/**
 * Per-section FAQ authoring for multi-page property types.
 *
 * The tab ids are a contract: they must equal the site's sub-page section
 * keys (overview/amenities/floor-plan/locality/photos). A mismatch would
 * silently file FAQs under a tab the site never reads.
 */
export const FAQ_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "amenities", label: "Amenities" },
  { id: "floor-plan", label: "Floor Plan" },
  { id: "locality", label: "Locality" },
  { id: "photos", label: "Photos" },
] as const;

export type FaqSectionId = (typeof FAQ_SECTIONS)[number]["id"];

export type FaqRow = {
  question?: string;
  answer?: string;
  section?: string | null;
};

const MULTI_PAGE_PROPERTY_TYPES = ["apartment", "villa", "individual_portion"];

/**
 * Only multi-page types curate FAQs per sub-page. Every other type —
 * including missing values — gets the one flat list (overview).
 */
export function hasFaqSections(
  propertyType: string | null | undefined,
): boolean {
  return !!propertyType && MULTI_PAGE_PROPERTY_TYPES.includes(propertyType);
}

/** Stored section, defaulting to overview. Never rewrites. */
export function sectionOf(faq: FaqRow | null | undefined): string {
  return faq?.section || "overview";
}

/**
 * Display grouping: rows with an unknown section file under overview so no
 * saved row can vanish from the form. Display-only — save preserves the
 * original section value.
 */
export function displaySectionOf(faq: FaqRow | null | undefined): string {
  const section = sectionOf(faq);
  return FAQ_SECTIONS.some((tab) => tab.id === section) ? section : "overview";
}
