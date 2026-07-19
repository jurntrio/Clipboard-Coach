import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InlineSignIn } from "@/components/auth/InlineSignIn";

const features = [
  {
    icon: "/branding/video-viewer.png",
    title: "Video Viewer",
    body: "Open any match file, scrub the timeline, and drop timestamped tags on the moments you want to revisit."
  },
  {
    icon: "/branding/teams.png",
    title: "Teams",
    body: "Build squads, add players, and link each tag to who made the play — so clips find the right people."
  },
  {
    icon: "/branding/clips.png",
    title: "Clips",
    body: "Turn your tagged moments into a clip library, ready to share with the full team or a single player."
  },
  {
    icon: "/branding/settings.png",
    title: "Settings",
    body: "Quick tags, player order, appearance — tuned to how you like to work."
  }
];

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-20 bg-page border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-18 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/branding/logo.png" alt="" width={36} height={36} className="rounded" />
            <span className="font-display uppercase tracking-wide text-textBright text-sm">
              Clipboard <span className="text-accent">Coach</span> Studio
            </span>
          </div>
          <div className="flex items-center gap-3">
            <InlineSignIn />
            <Link href="/signup" className="px-4 py-2 rounded-lg border border-borderButton text-textPrimary text-sm font-semibold hover:border-accent hover:text-accent">
              Register
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-3xl mx-auto px-6 pt-16 pb-10 text-center">
          <Image src="/branding/banner.png" alt="Clipboard Coach Studio" width={640} height={200} className="mx-auto mb-8" />
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-accent mb-4">Analyze · Coach · Improve · Win</p>
          <h1 className="font-display uppercase text-4xl sm:text-5xl leading-[0.95] text-textBright">
            Turn match footage into <span className="text-accent">moments that matter</span>
          </h1>
          <p className="max-w-xl mx-auto mt-5 text-textSecondary text-lg">
            Tag every key moment on the timeline, link plays to your players, and build a clip library your team can
            actually learn from.
          </p>
          <div className="flex gap-3 justify-center flex-wrap mt-8">
            <Link href="/signup" className="px-6 py-3 rounded-xl bg-accent text-page font-bold hover:opacity-90">
              Start reviewing
            </Link>
            <Link href="/login" className="px-6 py-3 rounded-xl border border-borderButton text-textPrimary font-bold hover:border-accent">
              Sign in
            </Link>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 py-16">
          <div className="text-center max-w-xl mx-auto mb-12">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-accent mb-2">One studio, four rooms</p>
            <h2 className="font-display uppercase text-3xl text-textBright">Everything a coach needs to review</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-card border border-border rounded-xl p-6 text-center hover:border-accent transition"
              >
                <Image src={feature.icon} alt="" width={72} height={72} className="mx-auto mb-3" />
                <h3 className="font-display uppercase text-textBright text-lg mb-1">{feature.title}</h3>
                <p className="text-textMuted text-sm">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-between gap-3 text-textMuted text-sm">
          <div className="flex items-center gap-2">
            <Image src="/branding/logo.png" alt="" width={24} height={24} className="rounded" />
            <span>Clipboard Coach Studio</span>
          </div>
          <span>Analyze · Coach · Improve · Win</span>
        </div>
      </footer>
    </div>
  );
}
