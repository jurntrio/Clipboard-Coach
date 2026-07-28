import { ParentHome } from "@/components/parent/ParentHome";

// Bereikbaar via de "Ouderweergave"-kaart op /dashboard voor een account dat zowel ouder is
// (gekoppeld aan minstens 1 kind via player_guardians) als een andere rol heeft (trainer/
// clubadmin/...). Een account dat UITSLUITEND ouder is, krijgt ParentHome al rechtstreeks op
// /dashboard zelf -- deze route bestaat enkel voor het dubbele-rol-geval.
export default function ParentDashboardPage() {
  return <ParentHome showBackLink />;
}
