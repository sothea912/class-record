import React from 'react';

export interface OptionStyleMeta {
  index: number;
  label: string;
  shapeName: string;
  bgClass: string;
  hoverClass: string;
  activeClass: string;
  borderClass: string;
  textClass: string;
  hexColor: string;
}

export const COHOST_OPTIONS: OptionStyleMeta[] = [
  {
    index: 0,
    label: 'Option 1',
    shapeName: 'Circle',
    bgClass: 'bg-teal-600',
    hoverClass: 'hover:bg-teal-500',
    activeClass: 'active:bg-teal-700',
    borderClass: 'border-teal-700',
    textClass: 'text-teal-400',
    hexColor: '#0d9488',
  },
  {
    index: 1,
    label: 'Option 2',
    shapeName: 'Diamond',
    bgClass: 'bg-fuchsia-600',
    hoverClass: 'hover:bg-fuchsia-500',
    activeClass: 'active:bg-fuchsia-700',
    borderClass: 'border-fuchsia-700',
    textClass: 'text-fuchsia-400',
    hexColor: '#c026d3',
  },
  {
    index: 2,
    label: 'Option 3',
    shapeName: 'Star',
    bgClass: 'bg-amber-500',
    hoverClass: 'hover:bg-amber-400',
    activeClass: 'active:bg-amber-600',
    borderClass: 'border-amber-600',
    textClass: 'text-amber-400',
    hexColor: '#d97706',
  },
  {
    index: 3,
    label: 'Option 4',
    shapeName: 'Hexagon',
    bgClass: 'bg-indigo-600',
    hoverClass: 'hover:bg-indigo-500',
    activeClass: 'active:bg-indigo-700',
    borderClass: 'border-indigo-700',
    textClass: 'text-indigo-400',
    hexColor: '#4f46e5',
  },
];

interface ShapeIconProps {
  index: number;
  className?: string;
  fill?: string;
}

export const CohostShapeIcon: React.FC<ShapeIconProps> = ({ index, className = 'w-6 h-6', fill = 'currentColor' }) => {
  switch (index) {
    case 0:
      // Teal Circle
      return (
        <svg viewBox="0 0 24 24" className={className} fill={fill}>
          <circle cx="12" cy="12" r="9.5" />
        </svg>
      );
    case 1:
      // Magenta Diamond (Rotated Square)
      return (
        <svg viewBox="0 0 24 24" className={className} fill={fill}>
          <path d="M12 2.5 L21.5 12 L12 21.5 L2.5 12 Z" />
        </svg>
      );
    case 2:
      // Amber Star
      return (
        <svg viewBox="0 0 24 24" className={className} fill={fill}>
          <polygon points="12,2.5 14.9,8.5 21.5,9.3 16.7,14 17.8,20.5 12,17.4 6.2,20.5 7.3,14 2.5,9.3 9.1,8.5" />
        </svg>
      );
    case 3:
      // Indigo Hexagon
      return (
        <svg viewBox="0 0 24 24" className={className} fill={fill}>
          <polygon points="12,2.5 20.2,7.25 20.2,16.75 12,21.5 3.8,16.75 3.8,7.25" />
        </svg>
      );
    default:
      return null;
  }
};
