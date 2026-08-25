import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { getServerI18n } from "@/i18n/server";
import { TERMS_VERSION } from "@/lib/legal";

export function generateMetadata(): Metadata {
  const { t } = getServerI18n();
  return { title: t("terms.title") };
}

export default function TermsPage() {
  const { t } = getServerI18n();
  return <LegalPage title={t("terms.title")} updated={t("legal.version", { version: TERMS_VERSION })}>
    <p>{t("terms.intro")}</p>
    <LegalSection title={t("terms.accountTitle")}><p>{t("terms.accountBody")}</p></LegalSection>
    <LegalSection title={t("terms.videosTitle")}><p>{t("terms.videosBody")}</p></LegalSection>
    <LegalSection title={t("terms.ownershipTitle")}><p>{t("terms.ownershipBody")}</p></LegalSection>
    <LegalSection title={t("terms.prohibitedTitle")}><p>{t("terms.prohibitedBody")}</p></LegalSection>
    <LegalSection title={t("terms.liabilityTitle")}><p>{t("terms.liabilityBody")}</p></LegalSection>
    <LegalSection title={t("terms.changesTitle")}><p>{t("terms.changesBody")}</p></LegalSection>
  </LegalPage>;
}
