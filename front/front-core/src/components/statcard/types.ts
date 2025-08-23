// types.ts
export interface BadgeData {
  iconName?: string;
  text: string;
  className?: string;
}

export interface CardData {
  title: string;
  value: string | number;
  badge: BadgeData;
  footerTitle: string;
  footerIconName?: string;
  footerDescription: string;
}

export interface IconProps {
  className?: string;
  size?: number;
  color?: string;
  stroke?: number;
}