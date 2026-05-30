/**
 * Hook that subscribes to realtime booking updates via WebSocket
 * and calls `onUpdate` when the backend emits a booking_update event.
 */
import { useEffect } from "react";
import { wsManager } from "../services/websocket";

export function useRealtimeBookings(onUpdate) {
  useEffect(() => {
    const unsub = wsManager.on("booking_update", onUpdate);
    return () => unsub();
  }, [onUpdate]);
}
