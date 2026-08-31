import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { errorResponse } from "@/lib/api-errors";
import { getScreensaverSettings } from "@/lib/photos";

// Read-only: settings are written via PATCH /api/family-group (screensaverEnabled/
// screensaverAlbumId/screensaverIntervalSeconds/screensaverIdleSeconds), same as
// holidayMode. This route exists separately because it also returns the selected album's
// photos, which the Wall/Dashboard need to actually render the slideshow.
export async function GET() {
  try {
    const ctx = await requireSession();
    const settings = await getScreensaverSettings(ctx);
    return NextResponse.json(settings);
  } catch (error) {
    return errorResponse(error);
  }
}
