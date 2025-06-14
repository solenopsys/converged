import * as TablerIcons from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Функция для рендеринга иконки по её имени
const renderIcon = (iconName, props = {}) => {
  const IconComponent = TablerIcons[iconName];
  return IconComponent ? <IconComponent {...props} /> : null;
};

// Отдельный компонент для карточки
const StatCard = ({ data }) => {
  const { 
    title, 
    value, 
    badge, 
    footerTitle, 
    footerIconName, 
    footerDescription 
  } = data;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        <CardAction>
          <Badge 
            variant="outline" 
            className={badge.className || ""}
          >
            {renderIcon(badge.iconName)}
            {badge.text}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          {footerTitle} {renderIcon(footerIconName, { className: "size-4" })}
        </div>
        <div className="text-muted-foreground">
          {footerDescription}
        </div>
      </CardFooter>
    </Card>
  );
};
import { useTranslation } from "react-i18next" // Импортируем хук для переводов
import { defaultLanguage } from "../i18n";
 
export function SectionCards() {
  // Используем namespace "cards" для получения переводов
  const { i18n } = useTranslation("cards");
  
  // Безопасное получение данных
  const getCardsData = () => {
    
      if (i18n.options && i18n.options.resources) {
        const lang = i18n.language || defaultLanguage;
        console.log("CARDS",lang);
        return i18n.options.resources[lang].cards?.cards || [];
      }
    
  };
  
  // Получаем данные
  const cardsData = getCardsData();
  
  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
      {Array.isArray(cardsData) && cardsData.length > 0 ? (
        cardsData.map((cardData, index) => (
          <StatCard key={index} data={cardData} />
        ))
      ) : (
        <div>Нет данных для отображения</div>
      )}
    </div>
  );
}