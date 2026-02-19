import { fail, isToolResponse, type ToolResponse } from "@luchibei/webmcp-sdk";

import { WEBMCP_TOOL_CALL, WEBMCP_TOOL_RESULT } from "./protocol.js";

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Bridge creation options.
 */
export interface CreateSwToolBridgeOptions {
  serviceWorkerPath: string;
  timeoutMs?: number;
}

/**
 * Page-side bridge for calling service worker handlers.
 */
export interface SwToolBridge {
  callInSw<TResult = unknown>(method: string, payload: unknown): Promise<ToolResponse<TResult>>;
  isReady(): boolean;
}

let activeBridge: SwToolBridge | null = null;

type ServiceWorkerContainerLike = {
  controller?: ServiceWorker | null;
  ready?: Promise<ServiceWorkerRegistration>;
  register: (
    scriptURL: string,
    options?: RegistrationOptions
  ) => Promise<ServiceWorkerRegistration>;
  getRegistration: (scope?: string) => Promise<ServiceWorkerRegistration | undefined>;
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent) => void,
    options?: boolean | AddEventListenerOptions
  ) => void;
  removeEventListener: (
    type: "message",
    listener: (event: MessageEvent) => void,
    options?: boolean | EventListenerOptions
  ) => void;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function toErrorDetails(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return error;
}

function getServiceWorkerContainer(): ServiceWorkerContainerLike | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  if (!("serviceWorker" in navigator)) {
    return null;
  }

  return navigator.serviceWorker as unknown as ServiceWorkerContainerLike;
}

function getMessageTarget(
  container: ServiceWorkerContainerLike,
  registration: ServiceWorkerRegistration | null
): ServiceWorker | null {
  if (container.controller) {
    return container.controller;
  }

  if (!registration) {
    return null;
  }

  return registration.active ?? registration.waiting ?? registration.installing ?? null;
}

/**
 * Returns the current default bridge set by `createSwToolBridge`.
 */
export function getActiveSwToolBridge(): SwToolBridge | null {
  return activeBridge;
}

/**
 * Creates a page-side postMessage bridge to service worker handlers.
 */
export function createSwToolBridge(options: CreateSwToolBridgeOptions): SwToolBridge {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
  let ready = false;

  const ensureRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
    const container = getServiceWorkerContainer();
    if (!container) {
      return null;
    }

    if (registrationPromise) {
      return registrationPromise;
    }

    registrationPromise = (async () => {
      try {
        const registration = await container.register(options.serviceWorkerPath, {
          scope: "/"
        });
        ready = true;
        return registration;
      } catch {
        try {
          const existingRegistration =
            (await container.getRegistration(options.serviceWorkerPath)) ??
            (await container.getRegistration()) ??
            null;

          ready = Boolean(existingRegistration);
          return existingRegistration;
        } catch {
          ready = false;
          return null;
        }
      }
    })();

    return registrationPromise;
  };

  const callInSw = async <TResult>(
    method: string,
    payload: unknown
  ): Promise<ToolResponse<TResult>> => {
    const container = getServiceWorkerContainer();
    if (!container) {
      return fail("SW_UNAVAILABLE", "Service Worker API is not available in this runtime.");
    }

    const registration = await ensureRegistration();
    if (!registration) {
      return fail("SW_UNAVAILABLE", "Service Worker registration is unavailable.");
    }

    const target = getMessageTarget(container, registration);
    if (!target) {
      return fail("SW_NOT_READY", "Service Worker is not ready to receive messages yet.");
    }

    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const requestedTool =
      isObject(payload) && typeof payload.tool === "string" ? payload.tool : method;
    const requestedInput = isObject(payload) && "input" in payload ? payload.input : payload;

    const request = {
      type: WEBMCP_TOOL_CALL,
      requestId,
      tool: requestedTool,
      method,
      input: requestedInput,
      payload
    };

    return new Promise<ToolResponse<TResult>>((resolve) => {
      const onMessage = (event: MessageEvent) => {
        const messageData = event.data;
        if (!isObject(messageData)) {
          return;
        }

        if (messageData.type !== WEBMCP_TOOL_RESULT) {
          return;
        }

        if (messageData.requestId !== requestId) {
          return;
        }

        cleanup();
        const response = "response" in messageData ? messageData.response : messageData;

        if (isToolResponse(response)) {
          resolve(response as ToolResponse<TResult>);
          return;
        }

        resolve(
          fail("SW_INVALID_RESPONSE", "Service Worker returned an invalid response payload.", {
            response
          })
        );
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        container.removeEventListener("message", onMessage);
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        resolve(fail("SW_TIMEOUT", `Service Worker call timed out after ${timeoutMs}ms.`));
      }, timeoutMs);

      container.addEventListener("message", onMessage);

      try {
        target.postMessage(request);
      } catch (error) {
        cleanup();
        resolve(
          fail("SW_POSTMESSAGE_FAILED", "Failed to post message to Service Worker.", {
            cause: toErrorDetails(error)
          })
        );
      }
    });
  };

  const bridge: SwToolBridge = {
    callInSw,
    isReady: () => ready
  };

  activeBridge = bridge;
  return bridge;
}
