import Image from "next/image";

type SvsBrandProps = {
  format?: "banner" | "square";
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
};

export function SvsBrand({
  format = "banner",
  width = format === "banner" ? 640 : 120,
  height = format === "banner" ? 160 : 120,
  className = "",
  priority = false
}: SvsBrandProps) {
  const dimensions = format === "banner" ? "1774 / 443" : "1 / 1";
  return (
    <span className={`svs-brand ${className}`} style={{ aspectRatio: dimensions }}>
      <Image
        src={`/branding/svs-${format}-dark.webp`}
        alt="Sport Visual Systems"
        width={width}
        height={height}
        priority={priority}
        unoptimized
        className="svs-brand-dark"
      />
      {/* Dark is the default theme. The hidden light logo stays lazy, so the
          browser only downloads it when the light theme actually shows it. */}
      <Image
        src={`/branding/svs-${format}-light.webp`}
        alt="Sport Visual Systems"
        width={width}
        height={height}
        loading="lazy"
        unoptimized
        className="svs-brand-light"
      />
    </span>
  );
}
