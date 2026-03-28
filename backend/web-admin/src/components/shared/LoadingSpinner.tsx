import { cn } from '@/utils/cn';

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export default function LoadingSpinner({ className, size = 'md', text }: LoadingSpinnerProps) {
  const sizeClass = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-12 w-12' }[size];

  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <div className={cn('animate-spin rounded-full border-b-2 border-ga-accent', sizeClass)} />
      {text && <p className="text-ga-text-secondary text-sm mt-3">{text}</p>}
    </div>
  );
}
