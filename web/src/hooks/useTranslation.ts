import { useLocaleStore } from "@/stores/locale";
import { t } from "@/i18n/translations";

export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  return (key: string) => t(key, locale);
}
