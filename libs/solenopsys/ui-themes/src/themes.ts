import { Theme } from "./interface";
 
export const DEFAULT_THEMES: { [name: string]: Theme } = {
    white: {
        background: '#ffffff',
        font: '#282626',
        tableHeader: '#d5d5d5',
        topPaneBackground: '#efefef',
        invertIcons: 'invert(0%)',
        invertLogo: 'invert(0%)',
        tableLineHover: '#f1f1f1',
        formBackground: 'gainsboro',
        inputBackground: 'white',
        buttonBackground: '#c1c1c1',
        groupBackground: '#f5f4f4',
    },
    black: {
        background: '#282626',
        font: '#afacac',
        tableHeader: '#494848',
        topPaneBackground: '#171717',
        invertIcons: 'invert(100%)',
        invertLogo: 'invert(100%)',
        tableLineHover: '#171717',
        formBackground: '#3b3b3b',
        inputBackground: '#e2e1e1',
        buttonBackground: 'black',
        groupBackground: '#1f1f1f',
    },
};

