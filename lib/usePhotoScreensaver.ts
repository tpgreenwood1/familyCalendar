import { useQuery } from "@tanstack/react-query";
import { subscribeToFamilyEvents } from "@/lib/realtime";
import type { ScreensaverSettingsDTO } from "@/lib/photos";

export const SCREENSAVER_SETTINGS_QUERY_KEY = ["photo-screensaver"];

async function fetchScreensaverSettings(): Promise<ScreensaverSettingsDTO> {
  const res = await fetch("/api/photos/screensaver");
  if (!res.ok) throw new Error("Could not load screensaver settings");
  return res.json();
}

/** Shared by `FamilyDashboard` and `WallDisplay` -- same query key as the "Photos" tile's
 * source of truth, so both stay coherent regardless of which one is mounted (same pattern
 * as lib/useDashboardQueries.ts). */
export function usePhotoScreensaver(initialSettings: ScreensaverSettingsDTO) {
  const { data } = useQuery({
    queryKey: SCREENSAVER_SETTINGS_QUERY_KEY,
    queryFn: fetchScreensaverSettings,
    initialData: initialSettings,
    refetchInterval: subscribeToFamilyEvents(),
  });
  return data;
}
