import LiveTagClient from "./LiveTagClient";
import { loadLiveTagPage } from "@/lib/live-tag-page";

export default async function LiveTagPage({ params }: { params: { token: string } }) {
  const data = await loadLiveTagPage(params.token);
  if (!data) return <main className="grid min-h-screen place-items-center bg-page p-6 text-textPrimary">Deze taglink is niet beschikbaar.</main>;
  return <LiveTagClient token={params.token} initialMatch={data.match} />;
}
