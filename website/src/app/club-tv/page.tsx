import type { Metadata } from "next";
import { ClubTvLanding } from "./ClubTvLanding";

export const metadata: Metadata = {
  title: "SVS Club TV",
  description:
    "Maak van elk scherm in je kantine, stadion of clubhuis een professioneel clubkanaal met sponsors, wedstrijden en clubnieuws.",
  alternates: { canonical: "/club-tv" },
};

export default function ClubTvLandingPage() {
  return <ClubTvLanding />;
}
