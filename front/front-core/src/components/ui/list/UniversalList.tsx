
// UniversalList.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import SimpleList from "./SimpleList";
import { SideMenuSimple } from "../SideMenu";

interface UniversalListProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  basePath: string;
  dataLoader: () => Promise<{ id: string; title: string }[]>;
}

const UniversalList: React.FC<UniversalListProps> = ({
  title,
  children,
  className = "",
  basePath,
  dataLoader
}) => {
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const params = useParams();
  
  const selectedId = params.codeName;
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
    const toUrl=`${basePath}/${id}`;
    console.log("Navigate to ",toUrl);
    navigate(toUrl);
  };

  const handleClose = () => {
    navigate(basePath);
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