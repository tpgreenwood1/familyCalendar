"use client";

import { useEffect, useRef } from "react";

/**
 * Wall display mode (DesignSpec.md §18): "automatic return to dashboard after inactivity
 * if appropriate". Applies only while `active` is true (i.e. the wall has drilled into a
 * member/shopping focus view away from the overview) — calls `onIdle` after `timeoutMs` of
 * no touch/pointer/key activity.
 */
export function useIdleReturn(active: boolean, timeoutMs: number, onIdle: () => void) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!active) return;

    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), timeoutMs);
    };

    const events = ["pointerdown", "touchstart", "keydown"] as const;
    events.forEach((event) => window.addEventListener(event, reset));
    reset();

    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [active, timeoutMs]);
}
