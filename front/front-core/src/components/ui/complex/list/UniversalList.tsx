import { cn } from "@/lib/utils";
import SimpleList from "./SimpleList";
import { SideMenuSimple } from "@/components/ui/SideMenu";

type UniversalListItem = {
  id: string;
  title: string;
};

type UniversalListProps = {
  title: string;
  items?: UniversalListItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onClose?: () => void;
  loading?: boolean;
  className?: string;
  sideTitle?: string;
  children?: JSX.Element;
};

const UniversalList = ({
  title,
  items = [],
  selectedId,
  onSelect,
  onClose,
  loading,
  className,
  sideTitle,
  children,
}: UniversalListProps) => {
  const isOpen = Boolean(selectedId);

  return (
    <div
      className={cn("w-full h-full bg-background relative flex flex-col", className)}
    >
      <SimpleList
        title={title}
        items={items}
        selectedId={selectedId}
        onSelect={onSelect}
        loading={loading}
      />

      <SideMenuSimple isOpen={isOpen} onClose={onClose || (() => {})}>
        <div className="flex flex-col gap-4 p-4">
          {sideTitle && <h3 className="font-semibold text-lg">{sideTitle}</h3>}
          <div>{children}</div>
        </div>
      </SideMenuSimple>
    </div>
  );
};

export { UniversalList };
