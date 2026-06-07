import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  type TouchableOpacityProps,
} from 'react-native';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<TouchableOpacityProps, 'onPress'> {
  onPress: () => void;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  textClassName?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

// ─── Style Maps ──────────────────────────────────────────────────────────────

const containerVariantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary items-center justify-center flex-row rounded-2xl shadow-sm active:opacity-80',
  secondary:
    'bg-secondary items-center justify-center flex-row rounded-2xl shadow-sm active:opacity-80',
  outline:
    'border-2 border-primary bg-transparent items-center justify-center flex-row rounded-2xl active:opacity-70',
  ghost:
    'bg-transparent items-center justify-center flex-row rounded-2xl active:opacity-60',
  danger:
    'bg-error items-center justify-center flex-row rounded-2xl shadow-sm active:opacity-80',
};

const textVariantStyles: Record<ButtonVariant, string> = {
  primary: 'text-white font-semibold',
  secondary: 'text-white font-semibold',
  outline: 'text-primary font-semibold',
  ghost: 'text-primary font-semibold',
  danger: 'text-white font-semibold',
};

const containerSizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 gap-1.5',
  md: 'h-12 px-6 gap-2',
  lg: 'h-14 px-8 gap-2.5',
};

const textSizeStyles: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

const indicatorColors: Record<ButtonVariant, string> = {
  primary: '#FFFFFF',
  secondary: '#FFFFFF',
  outline: '#FF6B35',
  ghost: '#FF6B35',
  danger: '#FFFFFF',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Button({
  onPress,
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className,
  textClassName,
  icon,
  iconPosition = 'left',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      className={cn(
        containerVariantStyles[variant],
        containerSizeStyles[size],
        isDisabled && 'opacity-50',
        className,
      )}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator
          size={size === 'sm' ? 'small' : 'small'}
          color={indicatorColors[variant]}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <View className="flex-row items-center">{icon}</View>
          )}
          <Text
            className={cn(
              textVariantStyles[variant],
              textSizeStyles[size],
              textClassName,
            )}
          >
            {children}
          </Text>
          {icon && iconPosition === 'right' && (
            <View className="flex-row items-center">{icon}</View>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

export default Button;
