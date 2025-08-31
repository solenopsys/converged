// SimpleList.tsx
import {
    Command,
    CommandList,
    CommandGroup,
    CommandItem,
  } from "@/components/ui/command";
  
  interface SimpleListProps {
    title: string;
    items: { id: string; title: string }[];
    onSelect: (id: string) => void;
    selectedId?: string;
    loading?: boolean;
  }
  
  export default function SimpleList({ title, items, onSelect, selectedId, loading }: SimpleListProps) {
    if (loading) {
      return (
        <Command className="rounded-lg border shadow-md">
          <CommandList>
            <CommandGroup heading={title}>
              <div className="p-4">
                <div className="animate-pulse">Загрузка...</div>
              </div>
            </CommandGroup>
          </CommandList>
        </Command>
      );
    }
  
    return (
      <Command className="rounded-lg border shadow-md">
        <CommandList>
          <CommandGroup heading={title}>
            {items.map(item => (
              <CommandItem 
                key={item.id} 
                onSelect={() => onSelect(item.id)}
                className={selectedId === item.id ? "bg-accent" : ""}
              >
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }
  