import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { cn } from '../../lib/utils';
import { User } from 'lucide-react';

interface UserAvatarProps {
  user?: UserProfile | null;
  name?: string;
  avatarUrl?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showBorder?: boolean;
}

const sizeClasses: Record<NonNullable<UserAvatarProps['size']>, { container: string; text: string; icon: string }> = {
  xs: { container: 'h-6 w-6 text-[10px]', text: 'text-[10px]', icon: 'h-3 w-3' },
  sm: { container: 'h-8 w-8 text-xs', text: 'text-xs', icon: 'h-4 w-4' },
  md: { container: 'h-10 w-10 text-sm', text: 'text-sm font-semibold', icon: 'h-5 w-5' },
  lg: { container: 'h-12 w-12 text-base', text: 'text-base font-semibold', icon: 'h-6 w-6' },
  xl: { container: 'h-16 w-16 text-xl', text: 'text-xl font-bold', icon: 'h-8 w-8' },
  '2xl': { container: 'h-20 w-20 text-2xl', text: 'text-2xl font-bold', icon: 'h-10 w-10' },
};

function getInitials(nameString?: string): string {
  if (!nameString) return '';
  const parts = nameString.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  name,
  avatarUrl,
  src,
  size = 'md',
  className,
  showBorder = false,
}) => {
  const [imageError, setImageError] = useState(false);

  const effectiveUrl =
    src !== undefined ? src : avatarUrl !== undefined ? avatarUrl : user?.avatar_url;
  const effectiveName = name || user?.full_name || user?.email || 'User';
  const initials = getInitials(effectiveName);
  const sizeConfig = sizeClasses[size];

  if (effectiveUrl && !imageError) {
    return (
      <div
        className={cn(
          'relative rounded-full overflow-hidden shrink-0 select-none bg-[#e6e8ec]',
          sizeConfig.container,
          showBorder && 'ring-2 ring-white shadow-xs',
          className,
        )}
      >
        <img
          src={effectiveUrl}
          alt={effectiveName}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-[#4f46e5] text-white flex items-center justify-center shrink-0 select-none font-medium shadow-xs',
        sizeConfig.container,
        showBorder && 'ring-2 ring-white',
        className,
      )}
      aria-label={effectiveName}
    >
      {initials ? (
        <span className={sizeConfig.text}>{initials}</span>
      ) : (
        <User className={sizeConfig.icon} />
      )}
    </div>
  );
};
