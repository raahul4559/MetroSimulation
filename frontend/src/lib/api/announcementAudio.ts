import { env } from "@/config/env";
import type { LanguageCode } from "@/domain/announcement";

/**
 * Talks to the backend's `POST /api/announcements/audio` (see
 * `backend/.../announcement/api/rest/AnnouncementAudioController.java`) — deliberately its own tiny
 * client rather than reusing `lib/api/client.ts`'s `createApiClient`, since that helper always
 * parses the response as JSON and this endpoint returns raw `audio/mpeg` bytes (or `204` when
 * synthesis is unavailable). Never throws: every failure mode (`204`, non-2xx, network error)
 * resolves to `null`, which `CachedAudioVoiceProvider` treats as "fall back to the next tier" — per
 * spec §11, missing audio must never surface as an error to its caller.
 */
export async function fetchAnnouncementAudio(text: string, language: LanguageCode): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(`${env.announcementApiBaseUrl}/audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });
    if (response.status === 204) return null; // synthesis unavailable — expected, not an error
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null; // network error, backend unreachable, etc.
  }
}
