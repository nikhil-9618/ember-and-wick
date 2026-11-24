"use client";

import { usePathname } from "next/navigation";

/**
 * A single, quiet page transition. Each navigation remounts this wrapper, whose
 * CSS animation fades and lifts the new page into place. Motion is defined in
 * globals.css and is disabled for visitors who ask for reduced motion.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
