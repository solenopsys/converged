// interfaces.ts
export interface ColorItem {
  color: string;
  name: string;
  description: string;
}

export interface ColorSchemesStore {
  schemes: { [key: string]: { [key: string]: any } };
  current: string;
  style: any;
  initColors: (style: any) => void;
  refreshStyle: () => void;
}

export interface Theme {
  background: string;
  font: string;
  tableHeader: string;
  topPaneBackground: string;
  invertIcons: string;
  invertLogo: string;
  tableLineHover: string;
  formBackground: string;
  inputBackground: string;
  buttonBackground: string;
  groupBackground: string;
}
