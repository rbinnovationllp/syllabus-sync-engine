export const ACQUISITION_SOURCE_OPTIONS = [
  { value: "company_representative", label: "Company Representative" },
  { value: "authorized_partner", label: "Authorized Partner / Referral Partner" },
  { value: "social_media", label: "Social Media" },
  { value: "online_advertisement", label: "Online Advertisement" },
  { value: "search_engine", label: "Search Engine" },
  { value: "existing_customer_reference", label: "Existing Customer Reference" },
  { value: "educational_event", label: "Educational Conference / Seminar / Workshop" },
  { value: "direct_website", label: "Website Visit (Direct)" },
  { value: "media_coverage", label: "Newspaper / Magazine / Media Coverage" },
  { value: "other", label: "Other" },
] as const;

export const ACQUISITION_DETAIL_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  social_media: [
    { value: "facebook", label: "Facebook" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "instagram", label: "Instagram" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "youtube", label: "YouTube" },
    { value: "x_twitter", label: "X (Twitter)" },
    { value: "other_social", label: "Other Social Media Platform" },
  ],
  online_advertisement: [
    { value: "google_ads", label: "Google Ads" },
    { value: "meta_ads", label: "Meta Ads (Facebook/Instagram Ads)" },
    { value: "linkedin_ads", label: "LinkedIn Ads" },
    { value: "youtube_ads", label: "YouTube Ads" },
    { value: "other_digital_ad", label: "Other Digital Advertisement" },
  ],
  search_engine: [
    { value: "google_search", label: "Google Search" },
    { value: "bing_search", label: "Bing Search" },
    { value: "other_search", label: "Other Search Engine" },
  ],
};

export type AcquisitionSourceValue = (typeof ACQUISITION_SOURCE_OPTIONS)[number]["value"];

export type AcquisitionFormValue = {
  acquisition_source: string;
  acquisition_detail?: string;
  partner_name?: string;
  partner_referral_code?: string;
  other_source?: string;
};

export function attributionLabelForSource(source: string | null | undefined) {
  return source === "authorized_partner" ? "Authorized Partner Acquisition" : "Direct Company Acquisition";
}

export function acquisitionSourceLabel(source: string | null | undefined) {
  return ACQUISITION_SOURCE_OPTIONS.find((item) => item.value === source)?.label ?? source ?? "Not captured";
}

export function acquisitionDetailLabel(source: string | null | undefined, detail: string | null | undefined) {
  if (!source || !detail) return "";
  return ACQUISITION_DETAIL_OPTIONS[source]?.find((item) => item.value === detail)?.label ?? detail;
}
