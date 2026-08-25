import type { Metadata } from "next";
import { HomeView } from "./HomeView";

export const metadata: Metadata = {
  alternates: { canonical: "/" }
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Sport Visual Systems",
  applicationCategory: "SportsApplication",
  operatingSystem: "Web",
  url: "https://app.sportvisualsystems.com",
  description: "Sportanalyse, teambeheer, videoreview en communicatie in één platform."
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <HomeView />
    </>
  );
}
