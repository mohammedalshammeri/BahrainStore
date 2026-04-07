const DEFAULT_API_URL = "http://localhost:3001/api";

function normalizeApiUrl(value: string) {
  return value.replace(/\/$/, "");
}

export function getPublicApiUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL;

  if (configured) {
    return normalizeApiUrl(configured);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL is required in production for the storefront");
  }

  return DEFAULT_API_URL;
}