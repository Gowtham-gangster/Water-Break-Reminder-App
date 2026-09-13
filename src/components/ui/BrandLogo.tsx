import React from 'react';
import { clsx } from 'clsx';
import pauseflowLogo from '../../assets/pauseflow-logo.png';

export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textClassName?: string;
  className?: string;
  imageClassName?: string;
  subtitle?: string;
}

const sizeConfig = {
  sm: {
    image: 'w-6 h-6 rounded-md',
    text: 'text-xs font-bold tracking-tight',
    gap: 'gap-2',
  },
  md: {
    image: 'w-7 h-7 rounded-lg shadow-sm shadow-sky-500/25',
    text: 'text-sm font-bold tracking-tight',
    gap: 'gap-2',
  },
  lg: {
    image: 'w-8 h-8 rounded-xl shadow-md shadow-sky-500/25',
    text: 'text-lg font-bold tracking-tight',
    gap: 'gap-2.5',
  },
  xl: {
    image: 'w-16 h-16 rounded-2xl shadow-xl shadow-sky-500/30',
    text: 'text-xl font-bold tracking-tight',
    gap: 'gap-3',
  },
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showText = true,
  textClassName,
  className,
  imageClassName,
  subtitle,
}) => {
  const config = sizeConfig[size];

  return (
    <div className={clsx('inline-flex items-center select-none', config.gap, className)}>
      <img
        src={pauseflowLogo}
        alt="PauseFlow"
        className={clsx(
          'object-contain shrink-0 aspect-square',
          config.image,
          imageClassName
        )}
      />
      {showText && (
        <div className="min-w-0">
          <span className={clsx('text-white/95 leading-none block', config.text, textClassName)}>
            PauseFlow
          </span>
          {subtitle && (
            <span className="text-[11px] text-[var(--text-muted)] font-medium leading-none block mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const PauseFlowLogo = BrandLogo;

