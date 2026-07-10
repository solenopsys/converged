import { useEffect, useState } from 'preact/hooks';
import type { Store } from 'effector';

export function useStore<T>(store: Store<T>): T {
  const [state, setState] = useState(store.getState());

  useEffect(() => {
    const subscription = store.watch(setState);
    return () => subscription.unsubscribe();
  }, [store]);

  return state;
}
