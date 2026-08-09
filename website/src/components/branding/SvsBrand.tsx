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
        src={`/branding/svs-${format}-dark.png`}
        alt="Sport Visual Systems"
        width={width}
        height={height}
        priority={priority}
        unoptimized
        className="svs-brand-dark"
      />
      <Image
        src={`/branding/svs-${format}-light.png`}
        alt="Sport Visual Systems"
        width={width}
        height={height}
        priority={priority}
        unoptimized
        className="svs-brand-light"
      />
    </span>
  );
}
