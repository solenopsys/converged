// hooks/useCardsData.ts
import { useTranslation } from "react-i18next";
import { defaultLanguage } from "../../i18n";
import { CardData } from "./types";

export const useCardsData = (): CardData[] => {
  const { i18n } = useTranslation("cards");
  
  const getCardsData = (): CardData[] => {
    if (i18n.options?.resources) {
      const lang = i18n.language || defaultLanguage;
      console.log("CARDS", lang);
      return i18n.options.resources[lang]?.cards?.cards || [];
    }
    return [];
  };
  
  return getCardsData();
};