/**
 * Realtime abstraction (DesignSpec.md §20/§47).
 *
 * Today this is backed by polling: `subscribeToFamilyEvents` just hands back the poll
 * interval for TanStack Query's `refetchInterval`, and `publishDomainEvent` is a no-op
 * call site that mutations invoke on every write. Keeping the call sites and function
 * shapes stable now means a later switch to SSE/WebSockets/Ably (per the spec's
 * escalation path) only touches this file, not the API routes or components that call it.
 */

export type DomainEventType =
  | "TODO_CREATED"
  | "TODO_UPDATED"
  | "TODO_COMPLETED"
  | "TODO_DELETED"
  | "CALENDAR_EVENT_CREATED"
  | "CALENDAR_EVENT_UPDATED"
  | "CALENDAR_EVENT_DELETED"
  | "CHORE_CREATED"
  | "CHORE_UPDATED"
  | "CHORE_DELETED"
  | "CHORE_OCCURRENCE_UPDATED"
  | "ROUTINE_CREATED"
  | "ROUTINE_UPDATED"
  | "ROUTINE_DELETED"
  | "ROUTINE_ITEM_COMPLETION_UPDATED"
  | "SHOPPING_ITEM_CREATED"
  | "SHOPPING_ITEM_UPDATED"
  | "SHOPPING_ITEM_DELETED"
  | "SPECIAL_OCCASION_CREATED"
  | "SPECIAL_OCCASION_UPDATED"
  | "SPECIAL_OCCASION_DELETED"
  | "FAMILY_GROUP_UPDATED";

export type DomainEvent = {
  type: DomainEventType;
  familyGroupId: number;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function publishDomainEvent(event: DomainEvent): void {
  // No-op under the polling provider -- TanStack Query's refetchInterval is the
  // "subscription". See subscribeToFamilyEvents.
}

/** How often clients should re-poll family-scoped domain data. */
export const REALTIME_POLL_INTERVAL_MS = 4000;

/** For components: the refetchInterval to hand TanStack Query for realtime-ish data. */
export function subscribeToFamilyEvents(): number {
  return REALTIME_POLL_INTERVAL_MS;
}
