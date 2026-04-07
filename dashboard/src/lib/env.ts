const DEFAULT_API_URL = "http://localhost:3001/api/v1";
const DEFAULT_STOREFRONT_URL = "http://localhost:3000";

function normalizeApiUrl(value: string) {
  return value.replace(/\/$/, "");
}

export function getPublicApiUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL;

  if (configured) {
    return normalizeApiUrl(configured);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL is required in production for the dashboard");
  }

  return DEFAULT_API_URL;
}

export function getPublicApiOrigin() {
  return getPublicApiUrl().replace(/\/api\/v1$/, "");
}

export function getPublicStorefrontOrigin() {
  const configured = process.env.NEXT_PUBLIC_STOREFRONT_URL;

  if (configured) {
    return normalizeApiUrl(configured);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_STOREFRONT_URL is required in production for the dashboard");
  }

  return DEFAULT_STOREFRONT_URL;
}