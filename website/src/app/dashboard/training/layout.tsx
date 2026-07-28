import { requireClubModule } from "@/lib/auth/club-module";

export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  await requireClubModule("training");
  return children;
}
