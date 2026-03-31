const DEFAULT_APP_URL = "http://localhost:3000"

export function getAppBaseUrl(): string {
  const configuredUrl = import.meta.env.WXT_BETTER_AUTH_BASE_URL?.trim()

  if (!configuredUrl) return DEFAULT_APP_URL

  try {
    return new URL(configuredUrl).toString().replace(/\/$/, "")
  } catch {
    return DEFAULT_APP_URL
  }
}
