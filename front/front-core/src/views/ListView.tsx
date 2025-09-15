
import SimpleList from "../components/ui/list/SimpleList";
import { ViewProps } from "./types"; 

export const ListView = (viewProps: ViewProps) => {
    console.log("VIEW PROX",viewProps)
 
    return (
        <div>
            <SimpleList
              items={viewProps.items}
              title={viewProps.title} 
              onSelect={viewProps.onSelect}
            />
        </div>
    )
}

 