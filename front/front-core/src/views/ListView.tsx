
import SimpleList from "../components/ui/list/SimpleList";
 
import { useUnit } from "effector-react";
import { Store } from "effector";

export const ListView = (viewProps: {$items: Store<{id:string,title:string}[]>, title: string, onSelect: (id: string) => void}) => {
   
    const items = useUnit(viewProps.$items)
    console.log("VIEW PROX",items)

    return (
        <div>
            <SimpleList
              items={items}
              title={viewProps.title} 
              onSelect={viewProps.onSelect}
            />
        </div>
    )
}

 