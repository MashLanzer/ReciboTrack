import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  type TextInputProps,
} from 'react-native';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type InputVariant = 'default' | 'outlined';

interface InputProps extends Omit<TextInputProps, 'onChangeText'> {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  hint?: string;
  secureTextEntry?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: InputVariant;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  hint,
  secureTextEntry = false,
  leftIcon,
  rightIcon,
  variant = 'default',
  disabled = false,
  className,
  inputClassName,
  ...rest
}: InputProps) {
  const [isSecureVisible, setIsSecureVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const showingSecure = secureTextEntry && !isSecureVisible;

  const containerBaseStyle =
    'flex-row items-center rounded-xl px-4 h-12 gap-3';

  const containerVariantStyle =
    variant === 'outlined'
      ? cn(
          'border-2 bg-white',
          error
            ? 'border-error'
            : isFocused
              ? 'border-primary'
              : 'border-gray-200',
        )
      : cn(
          'border',
          error
            ? 'border-error bg-red-50'
            : isFocused
              ? 'border-primary bg-primary/5'
              : 'border-gray-100 bg-gray-50',
        );

  return (
    <View className={cn('gap-1.5', className)}>
      {/* Label */}
      {label ? (
        <Text className="text-sm font-medium text-text-primary">{label}</Text>
      ) : null}

      {/* Input row */}
      <View
        className={cn(
          containerBaseStyle,
          containerVariantStyle,
          disabled && 'opacity-50',
        )}
      >
        {/* Left icon */}
        {leftIcon ? (
          <View className="items-center justify-center">{leftIcon}</View>
        ) : null}

        {/* Text input */}
        <TextInput
          className={cn(
            'flex-1 text-base text-text-primary',
            inputClassName,
          )}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={showingSecure}
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          {...rest}
        />

        {/* Secure-text toggle */}
        {secureTextEntry ? (
          <TouchableOpacity
            onPress={() => setIsSecureVisible((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text className="text-text-secondary text-sm">
              {isSecureVisible ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        ) : rightIcon ? (
          <View className="items-center justify-center">{rightIcon}</View>
        ) : null}
      </View>

      {/* Error message */}
      {error ? (
        <Text className="text-xs text-error font-medium ml-1">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-text-secondary ml-1">{hint}</Text>
      ) : null}
    </View>
  );
}

export default Input;
