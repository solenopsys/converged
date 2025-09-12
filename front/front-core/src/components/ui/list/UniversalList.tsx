// UniversalList.tsx
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import SimpleList from "./SimpleList";
import { SideMenuSimple } from "../SideMenu";

interface UniversalListProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  selectedId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  dataLoader: () => Promise<{ id: string; title: string }[]>;
}

const UniversalList: React.FC<UniversalListProps> = ({
  title,
  children,
  className = "",
  selectedId,
  onSelect,
  onClose,
  dataLoader
}) => {
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  
  const isOpen = Boolean(selectedId);

  // Загрузка данных через переданную функцию
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await dataLoader();
        setItems(data);
      } catch (error) {
        console.error('Error loading data:', error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dataLoader]);

  const handleSelect = (id: string) => {
    console.log("Select item with id:", id);
    onSelect(id);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className={cn("w-full h-full bg-background relative flex flex-col", className)}>
      <SimpleList
        title={title}
        items={items}
        onSelect={handleSelect}
        selectedId={selectedId}
        loading={loading}
      />

      <SideMenuSimple isOpen={isOpen} onClose={handleClose}>
        {children}
      </SideMenuSimple>
    </div>
  );
};

export { UniversalList };