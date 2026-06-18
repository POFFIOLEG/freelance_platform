import { useEffect, useRef } from "react";
import { API_BASE } from "../api/client.js";

function buildNotifyWsUrl(token) {
  const u = new URL(API_BASE);
  const proto = u.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${u.host}/ws/notify/?token=${encodeURIComponent(token)}`;
}

export function useNotifySocket(token, onEvent) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!token) return undefined;
    let ws;
    try {
      ws = new WebSocket(buildNotifyWsUrl(token));
    } catch {
      return undefined;
    }
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (
          data?.job_id != null &&
          ["worker_assigned", "work_submitted", "revision_requested", "released_from_job"].includes(
            data.event,
          )
        ) {
          window.dispatchEvent(new CustomEvent("job-notify-live", { detail: data }));
        }
        cbRef.current?.(data);
      } catch {
        /* ignore */
      }
    };
    return () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [token]);
}
