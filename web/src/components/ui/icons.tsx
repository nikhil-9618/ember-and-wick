import type { SVGProps } from "react";

/**
 * One small inline icon set for the storefront and admin surfaces.
 *
 * Inline SVG keeps the icons crisp at any size, inherits `currentColor` so they
 * match the surrounding type, and adds no dependency or icon-font request.
 */
export type IconName =
  | "search"
  | "bag"
  | "user"
  | "users"
  | "menu"
  | "close"
  | "mail"
  | "lock"
  | "phone"
  | "arrow-right"
  | "chevron-right"
  | "package"
  | "clipboard"
  | "heart"
  | "map-pin"
  | "ticket"
  | "truck"
  | "shield"
  | "sparkles"
  | "home"
  | "grid"
  | "star"
  | "log-out"
  | "chart"
  | "settings"
  | "check"
  | "alert"
  | "refresh"
  | "filter"
  | "clock"
  | "message"
  | "tag"
  | "card";

const PATHS: Record<IconName, React.ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  bag: (
    <>
      <path d="M5.5 8h13l1 12h-15l1-12Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <path d="M16 6.5a3 3 0 0 1 0 5.6" />
      <path d="M17 15.5a6 6 0 0 1 4 3.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="1.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  phone: <path d="M7 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v3a2 2 0 0 1-2.2 2A16 16 0 0 1 5 5.2 2 2 0 0 1 7 3Z" />,
  "arrow-right": <path d="M4 12h15M13 6l6 6-6 6" />,
  "chevron-right": <path d="m9 5 7 7-7 7" />,
  package: (
    <>
      <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
      <path d="m4 7 8 4 8-4M12 11v10" />
    </>
  ),
  clipboard: (
    <>
      <rect x="6" y="5" width="12" height="16" rx="1.5" />
      <path d="M9 5V3h6v2M9 11h6M9 15h4" />
    </>
  ),
  heart: <path d="M12 20s-7-4.6-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.4-7 9-7 9Z" />,
  "map-pin": (
    <>
      <path d="M12 21s6-5.6 6-10a6 6 0 1 0-12 0c0 4.4 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 9V6h16v3a3 3 0 0 0 0 6v3H4v-3a3 3 0 0 0 0-6Z" />
      <path d="M12 8v8" />
    </>
  ),
  truck: (
    <>
      <path d="M3 7h11v9H3V7Z" />
      <path d="M14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </>
  ),
  shield: <path d="M12 3l7 3v6c0 4.4-3 7.4-7 9-4-1.6-7-4.6-7-9V6l7-3Z" />,
  sparkles: (
    <>
      <path d="M12 3.5l1.6 4.4L18 9.5l-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6L12 3.5Z" />
      <path d="M17.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </>
  ),
  home: (
    <>
      <path d="M4 11 12 4l8 7v9H4v-9Z" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" />
      <rect x="13" y="4" width="7" height="7" />
      <rect x="4" y="13" width="7" height="7" />
      <rect x="13" y="13" width="7" height="7" />
    </>
  ),
  star: <path d="m12 4 2.4 5 5.6.8-4 4 1 5.6-5-2.7-5 2.7 1-5.6-4-4L9.6 9 12 4Z" />,
  "log-out": <path d="M10 5H5v14h5M14 8l4 4-4 4M9 12h9" />,
  chart: <path d="M4 4v16h16M8 16v-4M12 16V8M16 16v-6" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </>
  ),
  check: <path d="m5 13 4 4 10-10" />,
  alert: <path d="M12 4 3 20h18L12 4ZM12 10v4M12 17.5v.5" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" />,
  filter: <path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  message: <path d="M4 5h16v11H9l-5 4V5Z" />,
  tag: (
    <>
      <path d="M4 4h7l9 9-7 7-9-9V4Z" />
      <circle cx="8.5" cy="8.5" r="1.2" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <path d="M3 10h18" />
    </>
  ),
};

interface Props extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, className, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
