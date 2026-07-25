import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { getServerI18n } from "@/i18n/server";
import { PRIVACY_VERSION } from "@/lib/legal";

export default function PrivacyPage() {
  const { t } = getServerI18n();
  return <LegalPage title={t("privacyPolicy.title")} updated={t("legal.version", { version: PRIVACY_VERSION })}>
    <p>{t("privacyPolicy.intro")}</p>
    <LegalSection title={t("privacyPolicy.dataTitle")}><p>{t("privacyPolicy.dataBody")}</p></LegalSection>
    <LegalSection title={t("privacyPolicy.purposesTitle")}><p>{t("privacyPolicy.purposesBody")}</p></LegalSection>
    <LegalSection title={t("privacyPolicy.childrenTitle")}><p>{t("privacyPolicy.childrenBody")}</p></LegalSection>
    <LegalSection title={t("privacyPolicy.sharingTitle")}><p>{t("privacyPolicy.sharingBody")}</p></LegalSection>
    <LegalSection title={t("privacyPolicy.retentionTitle")}><p>{t("privacyPolicy.retentionBody")}</p></LegalSection>
    <LegalSection title={t("privacyPolicy.rightsTitle")}><p>{t("privacyPolicy.rightsBody")}</p></LegalSection>
  </LegalPage>;
}
