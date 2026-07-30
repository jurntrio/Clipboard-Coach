import { requireClubFeature } from "@/lib/auth/club-module";

export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  await requireClubFeature("training", "training.view");
  return children;
}
