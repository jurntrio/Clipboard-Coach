import { pageTitle } from "@/lib/page-metadata";

export const generateMetadata = pageTitle("page.player");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
