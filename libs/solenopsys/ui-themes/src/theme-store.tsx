// colorSchemesStore.tsx
import {   signal } from "@solenopsys/converged";

import { ColorSchemesStore, Theme } from "./interface";

export const createThemesStore = (themes: Theme[]): ColorSchemesStore => {
  const [schemes] = signal(themes); // todo move to props

  const [current, setCurrent] = signal(localStorage.getItem('colorScheme') || 'white');
  const [style, setStyle] = signal<any>(null);

  const refreshStyle = () => {
    const scheme = schemes()[current()];
    Object.keys(scheme).forEach(color => {
      style().setProperty('--' + color, scheme[color]);
    });
  };

  const initColors = (styleInstance: any) => {
    setStyle(styleInstance);
    refreshStyle();
  };

  return {
    schemes,
    current,
    style,
    initColors,
    refreshStyle,
  };
};

 
