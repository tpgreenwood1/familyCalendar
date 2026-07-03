import { prisma } from "@/lib/prisma";

const FALLBACK_LABEL = "Family Calendar";

async function getLabel(): Promise<{ label: string; error?: string }> {
  try {
    const config = await prisma.appConfig.findUnique({
      where: { key: "app_label" },
    });
    if (!config) return { label: FALLBACK_LABEL, error: "Label not found in database" };
    return { label: config.value };
  } catch {
    return { label: FALLBACK_LABEL, error: "Could not connect to database" };
  }
}

export default async function Home() {
  const { label, error } = await getLabel();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950">
      <p className="text-5xl font-light tracking-widest text-white">Hello Vicki</p>
      {error && (
        <p className="mt-4 text-sm text-gray-500">{error}</p>
      )}
    </main>
  );
}
