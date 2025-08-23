



// components/SectionCards.tsx
import { StatCard } from "./stat-card";
import { CardData } from "./types";

interface SectionCardsProps {
  cardsData: CardData[];
  className?: string;
  emptyMessage?: string;
}

export function SectionCards({ 
  cardsData,
  className = "",
  emptyMessage = "Нет данных для отображения"
}: SectionCardsProps) {
  return (
    <div className={`*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6 ${className}`}>
      {Array.isArray(cardsData) && cardsData.length > 0 ? (
        cardsData.map((cardData, index) => (
          <StatCard key={index} data={cardData} />
        ))
      ) : (
        <div>{emptyMessage}</div>
      )}
    </div>
  );
}