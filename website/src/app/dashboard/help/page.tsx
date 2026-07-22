import { SectionHeader } from "@/components/ui/SectionHeader";

const topics = [
  {
    title: "Teams & players",
    body: "Add a team from the Teams page, then open it to add players. Each player gets an avatar with their initials automatically."
  },
  {
    title: "Uploading a video",
    body: "Go to Videos, pick a team (optional), and drop in a video file. It uploads straight to storage — larger files take longer."
  },
  {
    title: "Tagging",
    body: "Open a video, select which players are on the field under 'Active players', then tap a quick-tag button (or type a custom one) while the video plays. Tags land on the timeline at the current time."
  },
  {
    title: "Building a clip",
    body: "Tick the tags you want in a clip using the checkboxes in the tag list, give the clip a name and an audience, then hit 'Create clip'."
  },
  {
    title: "Sharing a clip",
    body: "Open a clip from the Clips page and press 'Share' — a link is copied to your clipboard that anyone can open, no account needed."
  }
];

export default function HelpPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <SectionHeader title="Help" artworkSrc="/branding/help.png" />

      <div className="flex flex-col gap-3">
        {topics.map((topic) => (
          <div key={topic.title} className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-textBright font-semibold mb-1">{topic.title}</h2>
            <p className="text-textSecondary text-sm">{topic.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
