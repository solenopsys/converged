import { useEffect, useMemo, useReducer } from "preact/hooks";

type Store<T> = {
  getState(): T;
  watch(listener: (value: T) => void): () => void;
};

interface UnitShapeList extends ReadonlyArray<UnitShape> {}
interface UnitShapeRecord {
  [key: string]: UnitShape;
}

type UnitShape = Store<unknown> | ((...args: any[]) => any) | UnitShapeList | UnitShapeRecord;

function isStore(value: unknown): value is Store<unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as Store<unknown>).getState === "function" &&
      typeof (value as Store<unknown>).watch === "function",
  );
}

function collectStores(shape: UnitShape, result: Store<unknown>[] = []): Store<unknown>[] {
  if (isStore(shape)) {
    result.push(shape);
  } else if (Array.isArray(shape)) {
    shape.forEach((value) => collectStores(value, result));
  } else if (shape && typeof shape === "object") {
    Object.values(shape).forEach((value) => collectStores(value, result));
  }
  return result;
}

function resolveShape<T extends UnitShape>(shape: T): any {
  if (isStore(shape)) return shape.getState();
  if (Array.isArray(shape)) return shape.map(resolveShape);
  if (shape && typeof shape === "object") {
    return Object.fromEntries(Object.entries(shape).map(([key, value]) => [key, resolveShape(value)]));
  }
  return shape;
}


export function useUnit<T extends UnitShape>(shape: T): T extends Store<infer Value> ? Value : any {
  const stores = useMemo(() => collectStores(shape), [shape]);
  const [, rerender] = useReducer((version: number, _: void) => version + 1, 0);

  useEffect(() => {
    const unwatch = stores.map((store) => store.watch(() => rerender()));
    return () => unwatch.forEach((stop) => stop());
  }, [stores]);

  return resolveShape(shape);
}
