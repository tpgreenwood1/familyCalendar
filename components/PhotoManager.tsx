"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subscribeToFamilyEvents } from "@/lib/realtime";
import type { PhotoAlbumDTO, PhotoAlbumDetailDTO } from "@/lib/photos";

const ALBUMS_QUERY_KEY = ["photo-albums"];

type FamilyGroupSettings = {
  name: string;
  holidayMode: boolean;
  screensaverEnabled: boolean;
  screensaverAlbumId: number | null;
  screensaverIntervalSeconds: number;
  screensaverIdleSeconds: number;
};

async function fetchAlbums(): Promise<PhotoAlbumDTO[]> {
  const res = await fetch("/api/photos/albums");
  if (!res.ok) throw new Error("Could not load albums");
  return res.json();
}

async function fetchAlbum(albumId: number): Promise<PhotoAlbumDetailDTO> {
  const res = await fetch(`/api/photos/albums/${albumId}`);
  if (!res.ok) throw new Error("Could not load album");
  return res.json();
}

async function fetchFamilyGroup(): Promise<FamilyGroupSettings> {
  const res = await fetch("/api/family-group");
  if (!res.ok) throw new Error("Could not load family settings");
  return res.json();
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("could not read image"));
    };
    img.src = objectUrl;
  });
}

export default function PhotoManager({
  initialAlbums,
  initialFamilyGroup,
}: {
  initialAlbums: PhotoAlbumDTO[];
  initialFamilyGroup: FamilyGroupSettings;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [renamingAlbumId, setRenamingAlbumId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: albums = [] } = useQuery({
    queryKey: ALBUMS_QUERY_KEY,
    queryFn: fetchAlbums,
    initialData: initialAlbums,
    refetchInterval: subscribeToFamilyEvents(),
  });

  const { data: familyGroup } = useQuery({
    queryKey: ["family-group"],
    queryFn: fetchFamilyGroup,
    initialData: initialFamilyGroup,
    refetchInterval: subscribeToFamilyEvents(),
  });

  const { data: selectedAlbum } = useQuery({
    queryKey: ["photo-album", selectedAlbumId],
    queryFn: () => fetchAlbum(selectedAlbumId as number),
    enabled: selectedAlbumId !== null,
    refetchInterval: subscribeToFamilyEvents(),
  });

  function invalidateAlbums() {
    queryClient.invalidateQueries({ queryKey: ALBUMS_QUERY_KEY });
    if (selectedAlbumId !== null) {
      queryClient.invalidateQueries({ queryKey: ["photo-album", selectedAlbumId] });
    }
  }

  const createAlbum = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/photos/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create album");
      return body as PhotoAlbumDTO;
    },
    onSuccess: () => {
      invalidateAlbums();
      setNewAlbumName("");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const renameAlbum = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await fetch(`/api/photos/albums/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not rename album");
    },
    onSuccess: () => {
      invalidateAlbums();
      setRenamingAlbumId(null);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteAlbum = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/photos/albums/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete album");
    },
    onSuccess: (_data, id) => {
      invalidateAlbums();
      queryClient.invalidateQueries({ queryKey: ["family-group"] });
      if (selectedAlbumId === id) setSelectedAlbumId(null);
      setError(null);
    },
    onError: () => setError("Could not delete album. Please try again."),
  });

  const addPhoto = useMutation({
    mutationFn: async (payload: {
      albumId: number;
      blobUrl: string;
      blobPathname: string;
      width?: number;
      height?: number;
    }) => {
      const { albumId, ...body } = payload;
      const res = await fetch(`/api/photos/albums/${albumId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Could not save uploaded photo");
    },
    onSuccess: invalidateAlbums,
  });

  const deletePhoto = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      invalidateAlbums();
      setError(null);
    },
    onError: () => setError("Could not delete photo. Please try again."),
  });

  const updateScreensaver = useMutation({
    mutationFn: async (patch: Partial<FamilyGroupSettings>) => {
      const res = await fetch("/api/family-group", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not update screensaver settings");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-group"] });
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleCreateAlbum(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newAlbumName.trim();
    if (!trimmed) return;
    createAlbum.mutate(trimmed);
  }

  async function handleFilesSelected(albumId: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      try {
        const dimensions = await readImageDimensions(file).catch(() => null);
        const blob = await upload(`photos/${albumId}/${crypto.randomUUID()}-${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/photos/upload",
          clientPayload: String(albumId),
        });
        await addPhoto.mutateAsync({
          albumId,
          blobUrl: blob.url,
          blobPathname: blob.pathname,
          width: dimensions?.width,
          height: dimensions?.height,
        });
      } catch {
        setError(`Could not upload "${file.name}". Please try again.`);
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (selectedAlbum) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <button
          type="button"
          onClick={() => setSelectedAlbumId(null)}
          className="mb-6 text-sm text-gray-400 hover:text-white"
        >
          ◀ All albums
        </button>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-medium text-white">{selectedAlbum.name}</h2>
          <label className="cursor-pointer rounded-lg bg-gray-700 px-5 py-3 text-lg text-white hover:bg-gray-600">
            {uploading ? "Uploading…" : "+ Add photos"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={(e) => handleFilesSelected(selectedAlbum.id, e.target.files)}
              className="hidden"
            />
          </label>
        </div>

        {selectedAlbum.photos.length === 0 && (
          <p className="text-sm text-gray-500">No photos in this album yet — add some above.</p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {selectedAlbum.photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg bg-gray-900">
              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary Vercel Blob URLs */}
              <img src={photo.blobUrl} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => deletePhoto.mutate(photo.id)}
                aria-label="Delete photo"
                className="absolute right-2 top-2 rounded-full bg-black/70 px-3 py-1 text-sm text-white opacity-0 group-hover:opacity-100"
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8 rounded-xl border-t-4 border-gray-500 bg-gray-900 p-6">
        <h2 className="mb-4 text-2xl font-medium text-white">Screensaver</h2>
        <label className="mb-4 flex items-center gap-3 text-white">
          <input
            type="checkbox"
            checked={familyGroup?.screensaverEnabled ?? false}
            onChange={(e) => updateScreensaver.mutate({ screensaverEnabled: e.target.checked })}
            className="h-6 w-6 accent-gray-500"
          />
          Enable automatic screensaver on the Wall Display
        </label>

        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm text-gray-400">
            Album
            <select
              value={familyGroup?.screensaverAlbumId ?? ""}
              onChange={(e) =>
                updateScreensaver.mutate({
                  screensaverAlbumId: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="rounded-lg bg-gray-800 px-4 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <option value="">Not selected</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-400">
            Seconds between photos
            <input
              type="number"
              min={3}
              max={300}
              defaultValue={familyGroup?.screensaverIntervalSeconds ?? 10}
              onBlur={(e) =>
                updateScreensaver.mutate({ screensaverIntervalSeconds: Number(e.target.value) })
              }
              className="w-32 rounded-lg bg-gray-800 px-4 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-400">
            Idle seconds before it starts
            <input
              type="number"
              min={30}
              max={3600}
              defaultValue={familyGroup?.screensaverIdleSeconds ?? 300}
              onBlur={(e) => updateScreensaver.mutate({ screensaverIdleSeconds: Number(e.target.value) })}
              className="w-32 rounded-lg bg-gray-800 px-4 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
            />
          </label>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-medium text-white">Albums</h2>
      </div>

      <form onSubmit={handleCreateAlbum} className="mb-6 flex gap-2">
        <input
          type="text"
          value={newAlbumName}
          onChange={(e) => setNewAlbumName(e.target.value)}
          placeholder="New album name..."
          className="min-w-0 flex-1 rounded-lg bg-gray-800 px-4 py-3 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
        <button type="submit" className="rounded-lg bg-gray-700 px-5 py-3 text-lg text-white hover:bg-gray-600">
          + Add album
        </button>
      </form>

      {albums.length === 0 && (
        <p className="text-sm text-gray-500">No albums yet — create one above, then upload photos to it.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {albums.map((album) => (
          <div key={album.id} className="overflow-hidden rounded-xl bg-gray-900">
            <button
              type="button"
              onClick={() => setSelectedAlbumId(album.id)}
              className="block aspect-video w-full bg-gray-800"
            >
              {album.coverPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary Vercel Blob URLs
                <img src={album.coverPhotoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-4xl text-gray-600">📷</span>
              )}
            </button>
            <div className="flex items-center justify-between p-4">
              {renamingAlbumId === album.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = renameValue.trim();
                    if (trimmed) renameAlbum.mutate({ id: album.id, name: trimmed });
                  }}
                  className="flex flex-1 gap-2"
                >
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                    className="min-w-0 flex-1 rounded-lg bg-gray-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                  <button type="submit" className="text-sm text-gray-300 hover:text-white">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingAlbumId(null)}
                    className="text-sm text-gray-500 hover:text-gray-300"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedAlbumId(album.id)}
                    className="min-w-0 flex-1 truncate text-left text-lg text-white"
                  >
                    {album.name}
                    <span className="ml-2 text-sm text-gray-500">({album.photoCount})</span>
                  </button>
                  <div className="flex shrink-0 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingAlbumId(album.id);
                        setRenameValue(album.name);
                      }}
                      className="text-sm text-gray-400 hover:text-white"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete "${album.name}" and all its photos?`)) {
                          deleteAlbum.mutate(album.id);
                        }
                      }}
                      className="text-sm text-gray-400 hover:text-white"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
    </div>
  );
}
