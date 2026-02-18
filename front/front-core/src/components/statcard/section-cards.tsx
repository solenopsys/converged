



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
    <div className={`grid grid-cols-1 gap-4 p-4 grid-flow-dense auto-rows-[minmax(140px,auto)]
      @xl/main:grid-cols-2 @xl/main:auto-rows-[minmax(150px,auto)]
      @5xl/main:grid-cols-4 @5xl/main:auto-rows-[minmax(160px,auto)]
      @xl/main:[&>[data-slot=card]:nth-child(3n+1)]:col-span-2
      @5xl/main:[&>[data-slot=card]:nth-child(6n+1)]:col-span-2
      @5xl/main:[&>[data-slot=card]:nth-child(6n+1)]:row-span-2
      @5xl/main:[&>[data-slot=card]:nth-child(6n+2)]:col-span-2
      *:data-[slot=card]:shadow-xs *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card ${className}`}>
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
