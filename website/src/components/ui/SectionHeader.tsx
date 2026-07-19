import Link from "next/link";
import Image from "next/image";

export function SectionHeader({
  title,
  subtitle,
  artworkSrc
}: {
  title: string;
  subtitle?: string;
  artworkSrc: string;
}) {
  return (
    <header className="flex items-center gap-4 mb-5">
      <Link
        href="/dashboard"
        title="Home"
        className="flex-shrink-0 w-16 h-16 rounded-xl bg-button border border-borderButton flex items-center justify-center hover:border-accent hover:bg-cardHover transition"
      >
        <Image src="/branding/home.png" alt="Home" width={38} height={38} />
      </Link>
      <div className="flex-1">
        <h1 className="font-display uppercase text-2xl text-textBright">{title}</h1>
        {subtitle && <p className="text-textMuted text-sm">{subtitle}</p>}
      </div>
      <Image src={artworkSrc} alt="" width={56} height={56} className="flex-shrink-0" />
    </header>
  );
}
