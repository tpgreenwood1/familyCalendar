import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-errors";

export type CurrentUser = { id: string; email: string; name: string };

export type FamilyContext = {
  user: CurrentUser;
  familyGroupId: number;
};

/** For server components/pages: null means "not signed in" — distinct from "signed in but
 * no family yet" (see getFamilyMembership), since those redirect to different places. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function getFamilyMembership(userId: string) {
  return prisma.familyMembership.findUnique({ where: { userId } });
}

/** For API routes: 401 if unauthenticated, 409 if authenticated but not yet attached to a
 * family (DesignSpec.md §6.1 treats account creation and family membership as separate
 * steps — a session can validly exist in between). */
export async function requireSession(): Promise<FamilyContext> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "unauthorized");

  const membership = await getFamilyMembership(user.id);
  if (!membership) throw new ApiError(409, "not attached to a family yet");

  return { user, familyGroupId: membership.familyGroupId };
}

/**
 * Centralized permission checks (DesignSpec.md §6.2/§8).
 *
 * There is no ADULT/CHILD role split yet (that lands with FamilyMember roles in a
 * later phase) — every authenticated user currently has full access within their
 * own family, so every action is allowed. Routes should still call `can()` rather
 * than assuming access, so role checks can be added here later without touching
 * call sites.
 */
export type Action =
  | "family.update"
  | "familyMember.manage"
  | "todo.manage"
  | "invitation.create"
  | "calendarEvent.manage"
  | "chore.manage"
  | "choreOccurrence.manage"
  | "routine.manage"
  | "routineOccurrence.manage"
  | "shoppingItem.manage"
  | "specialOccasion.manage";

export function can(context: FamilyContext, action: Action): boolean {
  switch (action) {
    case "family.update":
    case "familyMember.manage":
    case "todo.manage":
    case "invitation.create":
    case "calendarEvent.manage":
    case "chore.manage":
    case "choreOccurrence.manage":
    case "routine.manage":
    case "routineOccurrence.manage":
    case "shoppingItem.manage":
    case "specialOccasion.manage":
      return true;
  }
}

export function requireCan(context: FamilyContext, action: Action): void {
  if (!can(context, action)) throw new ApiError(403, "forbidden");
}
