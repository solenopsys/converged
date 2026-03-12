import React from 'react';
import { MessageSquare } from 'lucide-react';

export interface ChatCardProps {
  data: any;
  columns?: any[];
  onAction?: (actionId: string, rowData: any) => void;
}

export const ChatCard: React.FC<ChatCardProps> = ({ data }) => {
  const name = data.name || 'Без названия';
  const description = data.description || '';
  const date = data.createdAt ? new Date(data.createdAt).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : '-';

  return (
    <div className="bg-background border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageSquare size={16} className="text-primary" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm leading-snug line-clamp-2 break-words">
            {name}
          </h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground pl-11">
        <span className="flex-shrink-0">{date}</span>
      </div>
    </div>
  );
};
