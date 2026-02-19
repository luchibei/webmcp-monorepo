import type { ModelContextTool } from "@webmcp/webmcp-sdk";
import { usePathname } from "next/navigation";
import { useMemo, type PropsWithChildren } from "react";

import { WebMcpProvider, type WebMcpRegistrationStrategy } from "./provider.js";

/**
 * Props for route-aware WebMCP boundary.
 */
export interface WebMcpRouteBoundaryProps extends PropsWithChildren {
  /**
   * Produces route-specific tools for the current pathname.
   */
  toolsFactory: (pathname: string) => ModelContextTool[];

  /**
   * Registration strategy passed down to `WebMcpProvider`.
   */
  strategy?: WebMcpRegistrationStrategy;
}

/**
 * Next.js App Router boundary that updates tools on pathname change.
 */
export function WebMcpRouteBoundary({
  toolsFactory,
  strategy = "registerTool",
  children
}: WebMcpRouteBoundaryProps) {
  const pathname = usePathname() ?? "/";
  const tools = useMemo(() => toolsFactory(pathname), [pathname, toolsFactory]);

  return (
    <WebMcpProvider tools={tools} strategy={strategy}>
      {children}
    </WebMcpProvider>
  );
}
