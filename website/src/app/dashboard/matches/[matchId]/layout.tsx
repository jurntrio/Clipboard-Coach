import { pageTitle } from "@/lib/page-metadata";

export const generateMetadata = pageTitle("page.match");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
