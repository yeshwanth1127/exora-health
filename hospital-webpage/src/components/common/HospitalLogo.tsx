import { hospitalLogo } from '../../data/clientBrand';

export function HospitalLogo({ className = 'size-10' }: { className?: string }) {
  return <img src={hospitalLogo} alt="Sri Lakshmi Hospital logo" width={64} height={64} className={`shrink-0 object-contain ${className}`} />;
}
