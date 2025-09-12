
import { UniversalList } from "@/components";
import { ViewProps } from "./types"; 

export const ListView = (viewProps: ViewProps) => {
    console.log("VIEW PROX",viewProps)
    return (
        <div>
            <UniversalList
              dataLoader={viewProps.dataSource}
              title={viewProps.title} 
            />
        </div>
    )
}

 