"use client";

import { useEffect, useRef, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { API_BASE } from "./api";

// ─────────────────────────────────────────────────────────────────────────────
// useSignalR — connects to /hubs/notifications without JWT auth.
// The hub identifies the client by departmentId / role passed as query params.
// ─────────────────────────────────────────────────────────────────────────────

interface SignalROptions {
  /** Department ID to join the Department_{id} group */
  departmentId?: number | null;
  /** Pass "Admin" to join the Admins group */
  role?: string | null;
  /** Whether to attempt connection (set to false until user is known) */
  enabled?: boolean;
}

type EventCallback = (payload: unknown) => void;

interface UseSignalRReturn {
  /** Register a listener for a SignalR event. Returns a cleanup function. */
  on: (eventName: string, callback: EventCallback) => () => void;
}

export function useSignalR(options: SignalROptions): UseSignalRReturn {
  const { departmentId, role, enabled = true } = options;
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  // Pending listeners registered before connection is ready
  const pendingListeners = useRef<Array<[string, EventCallback]>>([]);

  useEffect(() => {
    if (!enabled) return;

    const params = new URLSearchParams();
    if (departmentId != null) params.set("departmentId", String(departmentId));
    if (role) params.set("role", role);

    const url = `${API_BASE}/hubs/notifications${params.toString() ? `?${params}` : ""}`;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(url, {
        // Use WebSockets only for simplicity; skip Long Polling
        transport: signalR.HttpTransportType.WebSockets,
        skipNegotiation: true,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.None)
      .build();

    connectionRef.current = connection;

    // Register any listeners that were set before connection started
    for (const [evt, cb] of pendingListeners.current) {
      connection.on(evt, cb);
    }

    let isStopped = false;
    const startPromise = connection.start().catch((err) => {
      if (!isStopped) {
        console.warn("[SignalR] Connection failed:", err);
      }
    });

    return () => {
      isStopped = true;
      Promise.resolve(startPromise).finally(() => {
        if (connection.state !== signalR.HubConnectionState.Disconnected) {
          connection.stop().catch(() => {});
        }
      });
      connectionRef.current = null;
    };
  }, [enabled, departmentId, role]);

  const on = useCallback((eventName: string, callback: EventCallback) => {
    const conn = connectionRef.current;
    if (conn) {
      conn.on(eventName, callback);
    } else {
      // Queue until connection is established
      pendingListeners.current.push([eventName, callback]);
    }

    return () => {
      connectionRef.current?.off(eventName, callback);
      // Also remove from pending queue if it was never registered
      pendingListeners.current = pendingListeners.current.filter(
        ([, cb]) => cb !== callback
      );
    };
  }, []);

  return { on };
}
