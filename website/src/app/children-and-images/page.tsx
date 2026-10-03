import { pageTitle } from "@/lib/page-metadata";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { getServerI18n } from "@/i18n/server";

export default function ChildrenAndImagesPage() {
  const { t } = getServerI18n();
  return <LegalPage title={t("childrenPolicy.title")} updated={t("childrenPolicy.subtitle")}>
    <p>{t("childrenPolicy.intro")}</p>
    <LegalSection title={t("childrenPolicy.beforeTitle")}><ul className="list-disc space-y-2 pl-5"><li>{t("childrenPolicy.inform")}</li><li>{t("childrenPolicy.rules")}</li><li>{t("childrenPolicy.consent")}</li></ul></LegalSection>
    <LegalSection title={t("childrenPolicy.minimiseTitle")}><p>{t("childrenPolicy.minimiseBody")}</p></LegalSection>
    <LegalSection title={t("childrenPolicy.contactTitle")}><p>{t("childrenPolicy.contactBody")}</p></LegalSection>
    <LegalSection title={t("childrenPolicy.objectionTitle")}><p>{t("childrenPolicy.objectionBody")}</p></LegalSection>
  </LegalPage>;
}

export const generateMetadata = pageTitle("page.childrenAndImages");
