import { requireAdminOrViewer } from "@/lib/auth/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminOrViewer();

  return <>{children}</>;
}
