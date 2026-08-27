import Image from "next/image";

export function MenuIcon({ src, compact = false }: { src: string; compact?: boolean }) {
  const isVectorIcon = src.toLowerCase().endsWith(".svg");
  return (
    <span className={compact
      ? "relative block h-8 w-8 shrink-0 rounded-lg bg-black"
      : "relative block h-6 w-6 shrink-0 rounded-md bg-black sm:h-9 sm:w-9 sm:rounded-lg"
    }>
      <Image
        src={src}
        alt=""
        width={isVectorIcon ? (compact ? 24 : 30) : (compact ? 38 : 44)}
        height={isVectorIcon ? (compact ? 24 : 30) : (compact ? 38 : 44)}
        className={isVectorIcon
          ? compact
            ? "absolute left-1/2 top-1/2 h-6 w-6 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
            : "absolute left-1/2 top-1/2 h-5 w-5 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain sm:h-[30px] sm:w-[30px]"
          : compact
            ? "absolute left-1/2 top-1/2 h-[38px] w-[38px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
            : "absolute left-1/2 top-1/2 h-7 w-7 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain sm:h-11 sm:w-11"
        }
        style={{ filter: isVectorIcon
          ? "brightness(0) saturate(100%) invert(76%) sepia(95%) saturate(1915%) hue-rotate(85deg) brightness(112%) contrast(118%)"
          : undefined
        }}
      />
    </span>
  );
}
