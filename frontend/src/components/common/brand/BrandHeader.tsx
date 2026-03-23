import PoweredByAIBadge from './PoweredByAIBadge';

interface BrandHeaderProps {
  className?: string;
  logoSize?: 'small' | 'medium' | 'large';
}

export default function BrandHeader({ className = '', logoSize = 'medium' }: BrandHeaderProps) {
  const logoSizeClasses = {
    small: 'text-[24px]',
    medium: 'text-[24px] lg:text-[32px]',
    large: 'text-[32px]',
  };

  const gapClasses = {
    small: 'gap-4',
    medium: 'gap-4 lg:gap-6',
    large: 'gap-6',
  };

  return (
    <div className={`flex items-center ${gapClasses[logoSize]} ${className}`}>
      <p className={`font-logo ${logoSizeClasses[logoSize]} font-normal leading-[1.2] text-[var(--primary-main)]`}>
        atrips.me
      </p>
      <PoweredByAIBadge />
    </div>
  );
}
