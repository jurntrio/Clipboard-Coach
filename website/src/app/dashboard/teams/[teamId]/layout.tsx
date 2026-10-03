import { pageTitle } from "@/lib/page-metadata";

export const generateMetadata = pageTitle("page.team");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
