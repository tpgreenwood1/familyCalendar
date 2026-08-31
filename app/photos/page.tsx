import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, getFamilyMembership, type FamilyContext } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listAlbums, type PhotoAlbumDTO } from "@/lib/photos";
import PhotoManager from "@/components/PhotoManager";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Photos",
};

async function getPhotosData(ctx: FamilyContext) {
  try {
    const [albums, familyGroup] = await Promise.all([
      listAlbums(ctx),
      prisma.familyGroup.findUniqueOrThrow({ where: { id: ctx.familyGroupId } }),
    ]);
    const initialAlbums: PhotoAlbumDTO[] = JSON.parse(JSON.stringify(albums));
    return {
      albums: initialAlbums,
      familyGroup: {
        name: familyGroup.name,
        holidayMode: familyGroup.holidayMode,
        screensaverEnabled: familyGroup.screensaverEnabled,
        screensaverAlbumId: familyGroup.screensaverAlbumId,
        screensaverIntervalSeconds: familyGroup.screensaverIntervalSeconds,
        screensaverIdleSeconds: familyGroup.screensaverIdleSeconds,
      },
    };
  } catch {
    return { albums: [], familyGroup: null, error: "Could not connect to database" };
  }
}

export default async function PhotosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await getFamilyMembership(user.id);
  if (!membership) redirect("/family-setup");

  const { albums, familyGroup, error } = await getPhotosData({
    user,
    familyGroupId: membership.familyGroupId,
  });

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <h1 className="text-3xl font-light tracking-widest text-white">Photos</h1>
        {error && <p className="mt-4 text-sm text-gray-500">{error}</p>}
        <div className="mt-10 w-full max-w-6xl px-4">
          {familyGroup && <PhotoManager initialAlbums={albums} initialFamilyGroup={familyGroup} />}
        </div>
      </main>
      <Footer />
    </div>
  );
}
