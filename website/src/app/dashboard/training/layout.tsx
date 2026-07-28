import { requireClubModule, requireClubPermission } from "@/lib/auth/club-module";

export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  await requireClubModule("training");
  await requireClubPermission("training.view");
  return children;
}
