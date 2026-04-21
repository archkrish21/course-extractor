import Image from "next/image";

interface SapsLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const DIMENSIONS = {
  sm: 28,
  md: 32,
  lg: 40,
  xl: 48,
} as const;

export function SapsLogo({ size = "md", className = "" }: SapsLogoProps) {
  const dim = DIMENSIONS[size];
  return (
    <Image
      src="/favicon-96x96.png"
      alt="Plan with Genie"
      width={dim}
      height={dim}
      className={className}
      priority
    />
  );
}
