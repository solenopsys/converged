import React from 'react';
import { Mail } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface MailCardProps {
  data: any;
  columns: any[];
  onAction?: (actionId: string, rowData: any) => void;
}

export const MailCard: React.FC<MailCardProps> = ({ data }) => {
  const subject = data.subject || 'Без темы';
  const sender = data.sender || data.from || '-';
  const date = data.date ? new Date(data.date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : '-';

  return (
    <div className={cn(
      "bg-background border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer",
      "flex flex-col gap-2"
    )}>
      {/* Subject as title */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail size={16} className="text-primary" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm leading-snug line-clamp-2 break-words">
            {subject}
          </h3>
        </div>
      </div>

      {/* Sender and date as smaller text */}
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground pl-11">
        <span className="truncate flex-1">{sender}</span>
        <span className="flex-shrink-0">{date}</span>
      </div>
    </div>
  );
};
