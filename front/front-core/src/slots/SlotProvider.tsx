import { ReactNode } from "react";
import { Slot } from "./Slot";

import {  useLayoutEffect } from "react";
 
import { layoutReady } from "../slots";

export function SlotProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    layoutReady("global");
  }, []);

  return (
    <>
      {children}
      {/* Глобальная точка монтирования для компонентов без лайаута */}
      <div id="global-slot-mount">
        <Slot id="global:modal" />
        <Slot id="global:toast" />
        <Slot id="global:overlay" />
      </div>
    </>
  );
}
