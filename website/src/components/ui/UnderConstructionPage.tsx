import Image from "next/image";

export function UnderConstructionPage({ title, description, icon }: { title: string; description: string; icon: string }) {
  return <div className="mx-auto flex min-h-[65vh] max-w-2xl items-center justify-center p-6 text-center">
    <section className="w-full rounded-2xl border border-border bg-card p-8 shadow-lg sm:p-12">
      <Image src={icon} alt="" width={88} height={88} className="mx-auto h-20 w-20 object-contain" />
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-accent">In opbouw</p>
      <h1 className="mt-2 text-3xl font-black text-textBright">{title}</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-textMuted">{description}</p>
    </section>
  </div>;
}
