import { SectionHeader } from "@/components/ui/SectionHeader";
import { MediaWorkspace } from "@/components/media/MediaWorkspace";

export default function MediaPage() {
  return <main className="mx-auto max-w-7xl p-4 sm:p-8">
    <SectionHeader title="Media" subtitle="Sponsors, sponsorbereiken en commerciële thuiswedstrijden centraal beheren." artworkSrc="/branding/media.svg" showHome={false} />
    <MediaWorkspace />
  </main>;
}
