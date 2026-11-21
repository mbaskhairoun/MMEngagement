import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 28, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function ChurchIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M24 3v8M20.5 6.5h7" />
      <path d="M15 20a9 9 0 0 1 18 0" />
      <path d="M13 20h22M15 20v22M33 20v22" />
      <path d="M15 28H9v14M33 28h6v14" />
      <path d="M6 42h36" />
      <path d="M21 42v-7a3 3 0 0 1 6 0v7" />
      <path d="M24 24.5v3" />
    </Base>
  );
}

export function WavesIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M17 13a7 7 0 0 1 14 0" />
      <path d="M4 20c4 0 4-3.5 8-3.5s4 3.5 8 3.5 4-3.5 8-3.5 4 3.5 8 3.5 4-3.5 8-3.5" />
      <path d="M4 28c4 0 4-3.5 8-3.5s4 3.5 8 3.5 4-3.5 8-3.5 4 3.5 8 3.5 4-3.5 8-3.5" />
      <path d="M4 36c4 0 4-3.5 8-3.5s4 3.5 8 3.5 4-3.5 8-3.5 4 3.5 8 3.5 4-3.5 8-3.5" />
    </Base>
  );
}

export function RingsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="18.5" cy="30" r="10" />
      <circle cx="29.5" cy="30" r="10" />
      <path d="M29.5 19.5 26 15l3.5-4.5L33 15z" />
    </Base>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="24" cy="24" r="17" />
      <path d="M24 13v11l7 4" />
    </Base>
  );
}

export function CarIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 30l3.2-8.6A4 4 0 0 1 16 18.8h16a4 4 0 0 1 3.8 2.6L39 30" />
      <path d="M8 30h32a3 3 0 0 1 3 3v4H5v-4a3 3 0 0 1 3-3z" />
      <circle cx="14" cy="37" r="3" />
      <circle cx="34" cy="37" r="3" />
    </Base>
  );
}

export function SunsetIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 33h38" />
      <path d="M14 33a10 10 0 0 1 20 0" />
      <path d="M24 13v-4M12.7 18.7l-2.8-2.8M35.3 18.7l2.8-2.8M7 26H4M44 26h-3" />
      <path d="M11 39h9M26 39h11" />
    </Base>
  );
}

export function BreezeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 18h22a5 5 0 1 0-5-5" />
      <path d="M5 26h31a5 5 0 1 1-5 5" />
      <path d="M5 34h15" />
    </Base>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M24 43s-12-10.5-12-20a12 12 0 0 1 24 0c0 9.5-12 20-12 20z" />
      <circle cx="24" cy="23" r="4" />
    </Base>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="8" y="11" width="32" height="29" rx="3" />
      <path d="M8 19h32M16 7v8M32 7v8" />
      <path d="M17 28h2M23 28h2M29 28h2M17 34h2M23 34h2" />
    </Base>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M10 24h28M30 16l8 8-8 8" />
    </Base>
  );
}
