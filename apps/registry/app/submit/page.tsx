"use client";

import { useState } from "react";

interface SubmitResponse {
  site?: {
    id: string;
    name: string;
    url: string;
    status: string;
  };
  report?: {
    toolCount: number;
    warnings: string[];
    errors: string[];
  };
  error?: string;
}

export default function SubmitPage() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [verifyNow, setVerifyNow] = useState(true);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="grid">
      <section className="card grid">
        <h1 className="title">Submit WebMCP site</h1>
        <p className="muted">
          Register a website in the local directory and optionally run verification immediately.
        </p>

        <form
          className="grid"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitting(true);

            try {
              const response = await fetch("/api/sites", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  name,
                  url,
                  description,
                  verifyNow
                })
              });

              const payload = (await response.json()) as SubmitResponse;

              if (!response.ok) {
                setResult({ error: payload.error ?? "Submission failed." });
                return;
              }

              setResult(payload);
            } catch (error) {
              setResult({
                error: error instanceof Error ? error.message : "Submission failed."
              });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <label className="field">
            <span>Site name</span>
            <input
              className="input"
              required
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              placeholder="Demo Shop"
            />
          </label>

          <label className="field">
            <span>Site URL</span>
            <input
              className="input"
              required
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
              }}
              placeholder="https://example.com"
            />
          </label>

          <label className="field">
            <span>Description (optional)</span>
            <textarea
              className="textarea"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              placeholder="What this site enables for AI agents"
            />
          </label>

          <label
            className="field"
            style={{ gridTemplateColumns: "auto 1fr", alignItems: "center" }}
          >
            <input
              checked={verifyNow}
              onChange={(event) => {
                setVerifyNow(event.target.checked);
              }}
              type="checkbox"
            />
            <span>Verify immediately after submit</span>
          </label>

          <div className="button-row">
            <button className="button button-primary" disabled={submitting} type="submit">
              {submitting ? "Submitting..." : "Submit site"}
            </button>
          </div>
        </form>
      </section>

      {result ? (
        <section className="card grid">
          <h2 style={{ margin: 0 }}>Result</h2>
          {result.error ? <p className="muted">Error: {result.error}</p> : null}
          {result.site ? (
            <>
              <p className="muted">
                Saved <strong>{result.site.name}</strong> ({result.site.url})
              </p>
              <p className="muted">Status: {result.site.status}</p>
            </>
          ) : null}
          {result.report ? (
            <p className="muted">
              Verification captured {result.report.toolCount} tools, warnings:{" "}
              {result.report.warnings.length}, errors: {result.report.errors.length}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
