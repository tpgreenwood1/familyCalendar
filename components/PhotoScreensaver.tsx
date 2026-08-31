"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PhotoDTO } from "@/lib/photos";

/** Full-screen slideshow (DesignSpec.md §16B) -- launched either automatically after an
 * idle period or manually via a "Photos" tile. Any tap/click/key dismisses it immediately;
 * that's a plain event handler here, not lib/useIdleReturn.ts (which is for idle timeouts,
 * not immediate dismissal). */
export default function PhotoScreensaver({
  photos,
  intervalSeconds,
  onDismiss,
}: {
  photos: PhotoDTO[];
  intervalSeconds: number;
  onDismiss: () => void;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % photos.length), intervalSeconds * 1000);
    return () => clearInterval(id);
  }, [photos.length, intervalSeconds]);

  const photo = photos[index % photos.length];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onDismiss}
      onKeyDown={onDismiss}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary Vercel Blob URLs, not a known-size local asset next/image can optimize
        <img
          key={photo.id}
          src={photo.blobUrl}
          alt=""
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <p className="text-xl text-gray-400">
          No photos in this album yet —{" "}
          <Link href="/photos" className="underline hover:text-white" onClick={(e) => e.stopPropagation()}>
            add some
          </Link>
          .
        </p>
      )}
    </div>
  );
}
