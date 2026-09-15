function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.local and set it.`
    );
  }
  return value;
}

export const env = {
  apiBaseUrl: requireEnv(
    "NEXT_PUBLIC_API_BASE_URL",
    process.env.NEXT_PUBLIC_API_BASE_URL
  ),
  metroApiBaseUrl: requireEnv(
    "NEXT_PUBLIC_METRO_API_BASE_URL",
    process.env.NEXT_PUBLIC_METRO_API_BASE_URL
  ),
  trainSimApiBaseUrl: requireEnv(
    "NEXT_PUBLIC_TRAIN_SIM_API_BASE_URL",
    process.env.NEXT_PUBLIC_TRAIN_SIM_API_BASE_URL
  ),
  announcementApiBaseUrl: requireEnv(
    "NEXT_PUBLIC_ANNOUNCEMENT_API_BASE_URL",
    process.env.NEXT_PUBLIC_ANNOUNCEMENT_API_BASE_URL
  ),
  wsUrl: requireEnv("NEXT_PUBLIC_WS_URL", process.env.NEXT_PUBLIC_WS_URL),
} as const;
