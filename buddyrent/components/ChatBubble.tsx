import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import type { Message } from '@/types';

interface ChatBubbleProps {
  message: Message;
  isOwn: boolean;
  onAcceptBooking?: (messageId: string) => void;
  onDeclineBooking?: (messageId: string) => void;
}

export function ChatBubble({ message, isOwn, onAcceptBooking, onDeclineBooking }: ChatBubbleProps) {
  const time = format(new Date(message.createdAt), 'h:mm a');

  if (message.messageType === 'booking_request' && message.metadata) {
    const { activity, date, startTime, endTime, totalAmount, bookingId, status } = message.metadata as {
      activity: string;
      date: string;
      startTime: string;
      endTime: string;
      totalAmount: number;
      bookingId: string;
      status: string;
    };

    return (
      <View className={`max-w-[85%] mb-3 ${isOwn ? 'self-end' : 'self-start'}`}>
        <View className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <View className="bg-primary px-4 py-2">
            <Text className="text-white font-semibold text-sm">📅 Booking Request</Text>
          </View>
          <View className="p-4 gap-2">
            <View className="flex-row justify-between">
              <Text className="text-text-secondary text-xs">Activity</Text>
              <Text className="text-text-primary text-xs font-semibold">{activity}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-text-secondary text-xs">Date</Text>
              <Text className="text-text-primary text-xs font-semibold">{date}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-text-secondary text-xs">Time</Text>
              <Text className="text-text-primary text-xs font-semibold">{startTime} – {endTime}</Text>
            </View>
            <View className="h-px bg-gray-100 my-1" />
            <View className="flex-row justify-between">
              <Text className="text-text-primary text-sm font-bold">Total</Text>
              <Text className="text-primary text-sm font-bold">${totalAmount.toFixed(2)}</Text>
            </View>

            {status === 'pending' && !isOwn && (
              <View className="flex-row gap-2 mt-2">
                <TouchableOpacity
                  onPress={() => onDeclineBooking?.(message.id)}
                  className="flex-1 py-2 rounded-full border border-error"
                >
                  <Text className="text-error text-center text-sm font-semibold">Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onAcceptBooking?.(message.id)}
                  className="flex-1 py-2 rounded-full bg-success"
                >
                  <Text className="text-white text-center text-sm font-semibold">Accept</Text>
                </TouchableOpacity>
              </View>
            )}

            {status === 'confirmed' && (
              <View className="bg-success/10 rounded-lg p-2 mt-1">
                <Text className="text-success text-center text-xs font-semibold">✓ Booking Confirmed</Text>
              </View>
            )}

            {status === 'declined' && (
              <View className="bg-error/10 rounded-lg p-2 mt-1">
                <Text className="text-error text-center text-xs font-semibold">Booking Declined</Text>
              </View>
            )}
          </View>
        </View>
        <Text className={`text-xs text-text-secondary mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
          {time}
        </Text>
      </View>
    );
  }

  return (
    <View className={`max-w-[75%] mb-2 ${isOwn ? 'self-end items-end' : 'self-start items-start'}`}>
      <View
        className={`px-4 py-2.5 rounded-2xl ${
          isOwn
            ? 'bg-primary rounded-br-sm'
            : 'bg-white border border-gray-100 rounded-bl-sm shadow-sm'
        }`}
      >
        <Text className={`text-sm leading-5 ${isOwn ? 'text-white' : 'text-text-primary'}`}>
          {message.content}
        </Text>
      </View>
      <View className="flex-row items-center gap-1 mt-0.5 px-1">
        <Text className="text-xs text-text-secondary">{time}</Text>
        {isOwn && (
          <Text className="text-xs text-text-secondary">
            {message.isRead ? '✓✓' : '✓'}
          </Text>
        )}
      </View>
    </View>
  );
}
