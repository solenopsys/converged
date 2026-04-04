import { createEffect,  sample } from "effector";
import domain from "./domain";



// Bus data event
export const setBusData = domain.createEvent<{ bus: any, targetId: string, data: any }>();

// Bus data handler
setBusData.watch(({ bus, targetId, data }) => {
    bus.setData(targetId, data);
});

// Factory function
export function createDataFlow<T>(clientFn: () => Promise<{ names: string[] }>, transformFn?: (data: string[]) => T) {
    const event = domain.createEvent();
    const store = domain.createStore<string[]>([]);
    const effect = createEffect(clientFn);
    
    // Update store when effect completes
    store.on(effect.doneData, (_, data) => data.names);
    
    // Trigger effect on event
    sample({ clock: event, target: effect });
    
    // Send data to bus
    sample({ 
        clock: event,
        source: store,
        fn: (storeData, params) => ({
            bus: params.bus,
            targetId: params.targetId,
            data: transformFn ? transformFn(storeData) : storeData
        }),
        target: setBusData
    });
    
    return event;
}

// Create data flows













