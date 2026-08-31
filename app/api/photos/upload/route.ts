import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireSession, requireCan } from "@/lib/authz";
import { ApiError, errorResponse } from "@/lib/api-errors";
import { assertAlbumBelongsToFamily } from "@/lib/photos";

// Client uploads go straight to Vercel Blob (see components/PhotoManager.tsx's `upload()`
// call) -- this route only hands out a short-lived, album-scoped upload token, it never
// sees the file bytes. There is deliberately no `onUploadCompleted` here: that callback
// requires a publicly reachable webhook URL, which localhost can't satisfy, so the client
// instead POSTs the resolved blob's url/pathname to /api/photos/albums/[id]/photos once
// `upload()` resolves, keeping dev/prod behaviour identical.
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const ctx = await requireSession();
    requireCan(ctx, "photo.manage");

    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const albumId = Number(clientPayload);
        if (!clientPayload || Number.isNaN(albumId)) {
          throw new ApiError(400, "albumId is required");
        }
        await assertAlbumBelongsToFamily(ctx.familyGroupId, albumId);

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          addRandomSuffix: true,
          maximumSizeInBytes: 20 * 1024 * 1024,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return errorResponse(error);
  }
}
