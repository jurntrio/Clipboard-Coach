import { pageTitle } from "@/lib/page-metadata";

export const generateMetadata = pageTitle("page.settings");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
