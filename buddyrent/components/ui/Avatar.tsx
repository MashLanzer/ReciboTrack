import React from 'react';
import { View, Text, Image } from 'react-native';
import { cn, getInitials } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  source?: string | null;
  size?: AvatarSize;
  name?: string;
  isOnline?: boolean;
  className?: string;
}

// ─── Size Maps ────────────────────────────────────────────────────────────────

const containerSizeStyles: Record<AvatarSize, string> = {
  sm: 'w-8 h-8 rounded-full',
  md: 'w-12 h-12 rounded-full',
  lg: 'w-16 h-16 rounded-full',
  xl: 'w-24 h-24 rounded-full',
};

const textSizeStyles: Record<AvatarSize, string> = {
  sm: 'text-xs font-bold',
  md: 'text-sm font-bold',
  lg: 'text-lg font-bold',
  xl: 'text-2xl font-bold',
};

const indicatorSizeStyles: Record<AvatarSize, string> = {
  sm: 'w-2 h-2 border',
  md: 'w-3 h-3 border',
  lg: 'w-4 h-4 border-2',
  xl: 'w-5 h-5 border-2',
};

const indicatorPositionStyles: Record<AvatarSize, string> = {
  sm: 'bottom-0 right-0',
  md: 'bottom-0 right-0',
  lg: 'bottom-0.5 right-0.5',
  xl: 'bottom-1 right-1',
};

// Gradient-like background colors for initials fallback
const FALLBACK_COLORS = [
  'bg-primary',
  'bg-secondary',
  'bg-accent',
  'bg-success',
  'bg-warning',
];

function pickColor(name: string): string {
  if (!name) return FALLBACK_COLORS[0];
  const code = name
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return FALLBACK_COLORS[code % FALLBACK_COLORS.length];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Avatar({
  source,
  size = 'md',
  name = '',
  isOnline,
  className,
}: AvatarProps) {
  const initials = getInitials(name);
  const bgColor = pickColor(name);

  return (
    <View className={cn('relative', className)}>
      {source ? (
        <Image
          source={{ uri: source }}
          className={cn(containerSizeStyles[size], 'border-2 border-white')}
          resizeMode="cover"
        />
      ) : (
        <View
          className={cn(
            containerSizeStyles[size],
            bgColor,
            'items-center justify-center border-2 border-white',
          )}
        >
          <Text className={cn(textSizeStyles[size], 'text-white')}>
            {initials}
          </Text>
        </View>
      )}

      {/* Online indicator */}
      {isOnline !== undefined && (
        <View
          className={cn(
            'absolute rounded-full border-white',
            isOnline ? 'bg-success' : 'bg-gray-400',
            indicatorSizeStyles[size],
            indicatorPositionStyles[size],
          )}
        />
      )}
    </View>
  );
}

export default Avatar;
