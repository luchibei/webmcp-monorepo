"use client";

import { useState } from "react";

export function VerifySiteButton({ url }: { url: string }) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  return (
    <div className="grid" style={{ gap: 8 }}>
      <button
        className="button button-primary"
        disabled={status === "running"}
        type="button"
        onClick={async () => {
          setStatus("running");
          setMessage("");

          try {
            const response = await fetch(`/api/verify?url=${encodeURIComponent(url)}`);
            const payload = (await response.json()) as {
              error?: string;
              report?: { toolCount: number };
            };

            if (!response.ok) {
              setStatus("error");
              setMessage(payload.error ?? "Verification failed.");
              return;
            }

            setStatus("done");
            setMessage(`Verification complete. Captured ${payload.report?.toolCount ?? 0} tools.`);
            window.location.reload();
          } catch (error) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Verification failed.");
          }
        }}
      >
        {status === "running" ? "Verifying..." : "Run Verify"}
      </button>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
