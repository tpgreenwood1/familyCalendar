import type { ShoppingItem, ShoppingItemCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FamilyContext } from "@/lib/authz";
import { ApiError } from "@/lib/api-errors";
import { publishDomainEvent } from "@/lib/realtime";
import { capitalize } from "@/lib/textFormat";

export type ShoppingItemDTO = {
  id: number;
  name: string;
  category: ShoppingItemCategory;
  checked: boolean;
  checkedAt: Date | null;
  createdAt: Date;
};

function toDTO(item: ShoppingItem): ShoppingItemDTO {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    checked: item.checked,
    checkedAt: item.checkedAt,
    createdAt: item.createdAt,
  };
}

/** V1 is exactly one list per family (§16) -- enforced by ShoppingList.familyGroupId's
 * unique constraint, so this doubles as "find-or-create the family's list" without a
 * race: a concurrent duplicate create just hits the unique constraint and this refetches. */
async function getOrCreateShoppingList(familyGroupId: number): Promise<{ id: number }> {
  const existing = await prisma.shoppingList.findUnique({
    where: { familyGroupId },
    select: { id: true },
  });
  if (existing) return existing;

  try {
    return await prisma.shoppingList.create({
      data: { familyGroupId },
      select: { id: true },
    });
  } catch {
    return prisma.shoppingList.findUniqueOrThrow({
      where: { familyGroupId },
      select: { id: true },
    });
  }
}

export async function listShoppingItems(ctx: FamilyContext): Promise<ShoppingItemDTO[]> {
  const list = await getOrCreateShoppingList(ctx.familyGroupId);
  const items = await prisma.shoppingItem.findMany({
    where: { shoppingListId: list.id },
    orderBy: { createdAt: "asc" },
  });
  return items.map(toDTO);
}

export async function addShoppingItem(
  ctx: FamilyContext,
  name: string,
  category: ShoppingItemCategory
): Promise<ShoppingItemDTO> {
  const list = await getOrCreateShoppingList(ctx.familyGroupId);
  const item = await prisma.shoppingItem.create({
    data: { shoppingListId: list.id, name: capitalize(name), category },
  });

  publishDomainEvent({ type: "SHOPPING_ITEM_CREATED", familyGroupId: ctx.familyGroupId });

  return toDTO(item);
}

export async function setShoppingItemChecked(
  ctx: FamilyContext,
  id: number,
  checked: boolean
): Promise<ShoppingItemDTO> {
  const existing = await prisma.shoppingItem.findFirst({
    where: { id, shoppingList: { familyGroupId: ctx.familyGroupId } },
  });
  if (!existing) throw new ApiError(404, "not found");

  const item = await prisma.shoppingItem.update({
    where: { id },
    data: { checked, checkedAt: checked ? new Date() : null },
  });

  publishDomainEvent({ type: "SHOPPING_ITEM_UPDATED", familyGroupId: ctx.familyGroupId });

  return toDTO(item);
}

export async function deleteShoppingItem(ctx: FamilyContext, id: number): Promise<void> {
  const existing = await prisma.shoppingItem.findFirst({
    where: { id, shoppingList: { familyGroupId: ctx.familyGroupId } },
  });
  if (!existing) throw new ApiError(404, "not found");

  await prisma.shoppingItem.delete({ where: { id } });

  publishDomainEvent({ type: "SHOPPING_ITEM_DELETED", familyGroupId: ctx.familyGroupId });
}
