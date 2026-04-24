interface GenieWordmarkProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CONFIG = {
  sm: { height: 32 },
  md: { height: 44 },
  lg: { height: 56 },
  xl: { height: 72 },
} as const;

export function GenieWordmark({ size = "md", className = "" }: GenieWordmarkProps) {
  const { height } = SIZE_CONFIG[size];
  const width = (height * 170) / 100;

  return (
    <svg
      role="img"
      aria-label="planwithGenie"
      viewBox="0 -12 170 100"
      height={height}
      width={width}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 130 24 C 123 37, 137 52, 130 68"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
        opacity="0.75"
        className="stroke-primary dark:stroke-accent"
      />
      <circle
        cx="130"
        cy="11"
        r="4"
        className="fill-primary dark:fill-accent"
      />

      <text
        x="123"
        y="31"
        textAnchor="end"
        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="18"
        fontWeight="600"
        letterSpacing="1.2"
        className="fill-accent dark:fill-foreground"
      >
        planw
      </text>
      <text
        x="137"
        y="31"
        textAnchor="start"
        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="18"
        fontWeight="600"
        letterSpacing="1.2"
        className="fill-accent dark:fill-foreground"
      >
        th
      </text>

      <text
        x="123"
        y="73"
        textAnchor="end"
        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontWeight="900"
        letterSpacing="-2"
        className="fill-primary dark:fill-accent"
      >
        <tspan fontSize="72">G</tspan>
        <tspan fontSize="56">en</tspan>
      </text>
      <text
        x="137"
        y="73"
        textAnchor="start"
        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="56"
        fontWeight="900"
        letterSpacing="-2"
        className="fill-primary dark:fill-accent"
      >
        e
      </text>
    </svg>
  );
}
