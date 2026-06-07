import React from 'react';
import { View, Text } from 'react-native';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  color?: string;
  size?: BadgeSize;
  emoji?: string;
  className?: string;
  textClassName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Badge pill for displaying activity tags, statuses, or labels.
 * When `color` is a hex string (e.g. "#FF6B35"), it is applied via inline style
 * because NativeWind cannot generate dynamic class names at runtime.
 */
export function Badge({
  label,
  color,
  size = 'md',
  emoji,
  className,
  textClassName,
}: BadgeProps) {
  const containerStyle =
    size === 'sm'
      ? 'flex-row items-center gap-1 px-2 py-0.5 rounded-full'
      : 'flex-row items-center gap-1.5 px-3 py-1 rounded-full';

  const textStyle =
    size === 'sm' ? 'text-xs font-medium' : 'text-sm font-medium';

  // Determine background: use inline style when color is provided (hex/rgb),
  // otherwise fall back to a NativeWind teal default.
  const hasCustomColor = Boolean(color);

  return (
    <View
      className={cn(
        containerStyle,
        !hasCustomColor && 'bg-secondary/20',
        className,
      )}
      style={
        hasCustomColor
          ? { backgroundColor: color + '26' /* ~15% opacity */ }
          : undefined
      }
    >
      {emoji ? (
        <Text className={size === 'sm' ? 'text-xs' : 'text-sm'}>{emoji}</Text>
      ) : null}
      <Text
        className={cn(
          textStyle,
          !hasCustomColor && 'text-secondary',
          textClassName,
        )}
        style={hasCustomColor ? { color } : undefined}
      >
        {label}
      </Text>
    </View>
  );
}

export default Badge;
