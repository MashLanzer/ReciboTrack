import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useBookingStore } from '@/stores/bookingStore';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/ui/Avatar';
import type { Booking, BookingStatus } from '@/types';

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: '#F59E0B', bg: '#FEF3C7' },
  confirmed: { label: 'Confirmed', color: '#10B981', bg: '#D1FAE5' },
  active:    { label: 'Active',    color: '#3B82F6', bg: '#DBEAFE' },
  completed: { label: 'Completed', color: '#6B7280', bg: '#F3F4F6' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bg: '#FEE2E2' },
  disputed:  { label: 'Disputed',  color: '#8B5CF6', bg: '#EDE9FE' },
  refunded:  { label: 'Refunded',  color: '#6B7280', bg: '#F3F4F6' },
};

function BookingCard({ booking, currentUserId }: { booking: Booking; currentUserId: string }) {
  const isBuddy = booking.buddyId === currentUserId;
  const otherUser = isBuddy ? booking.seekerProfile : booking.buddyProfile;
  const status = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;

  return (
    <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-3 mx-4">
      <View className="flex-row items-center gap-3 mb-3">
        <Avatar
          source={otherUser?.photos?.[0] ? { uri: otherUser.photos[0] } : null}
          name={otherUser?.name ?? '?'}
          size="md"
        />
        <View className="flex-1">
          <Text className="text-text-primary font-semibold text-base">{otherUser?.name}</Text>
          <Text className="text-text-secondary text-sm">{isBuddy ? 'Seeker' : 'Your Buddy'}</Text>
        </View>
        <View className="px-3 py-1 rounded-full" style={{ backgroundColor: status.bg }}>
          <Text className="text-xs font-semibold" style={{ color: status.color }}>{status.label}</Text>
        </View>
      </View>

      <View className="bg-surface rounded-xl p-3 gap-1.5 mb-3">
        <View className="flex-row items-center gap-2">
          <Ionicons name="baseball-outline" size={14} color="#6B7280" />
          <Text className="text-text-primary font-medium capitalize">{booking.activity}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Ionicons name="calendar-outline" size={14} color="#6B7280" />
          <Text className="text-text-secondary text-sm">
            {format(new Date(booking.date), 'EEE, MMM d, yyyy')}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Ionicons name="time-outline" size={14} color="#6B7280" />
          <Text className="text-text-secondary text-sm">
            {booking.startTime} – {booking.endTime} ({booking.hours} hrs)
          </Text>
        </View>
        {booking.location && (
          <View className="flex-row items-center gap-2">
            <Ionicons name="location-outline" size={14} color="#6B7280" />
            <Text className="text-text-secondary text-sm" numberOfLines={1}>{booking.location}</Text>
          </View>
        )}
      </View>

      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-text-secondary text-xs">
            {isBuddy ? 'You earn' : 'Total'}
          </Text>
          <Text className="text-primary font-bold text-base">
            ${isBuddy ? booking.buddyEarnings.toFixed(2) : booking.totalAmount.toFixed(2)}
          </Text>
        </View>

        <View className="flex-row gap-2">
          {booking.status === 'confirmed' && (
            <TouchableOpacity
              onPress={() => router.push(`/(tabs)/messages/${booking.seekerId}`)}
              className="flex-row items-center gap-1 border border-gray-200 rounded-full px-3 py-1.5"
            >
              <Ionicons name="chatbubble-outline" size={14} color="#6B7280" />
              <Text className="text-text-secondary text-xs font-medium">Message</Text>
            </TouchableOpacity>
          )}
          {booking.status === 'completed' && (
            <TouchableOpacity
              className="bg-primary rounded-full px-3 py-1.5"
            >
              <Text className="text-white text-xs font-semibold">Leave Review</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export default function BookingsScreen() {
  const { user } = useAuthStore();
  const { bookings, isLoading, loadMyBookings } = useBookingStore();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    if (user?.id) {
      loadMyBookings(user.id, 'seeker');
    }
  }, [user?.id]);

  const upcoming = bookings.filter(b => ['pending', 'confirmed', 'active'].includes(b.status));
  const past = bookings.filter(b => ['completed', 'cancelled', 'refunded'].includes(b.status));
  const displayed = tab === 'upcoming' ? upcoming : past;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="px-4 pt-3 pb-2">
        <Text className="text-text-primary font-bold text-2xl mb-3" style={{ fontFamily: 'Poppins' }}>
          Bookings
        </Text>

        {/* Segmented Control */}
        <View className="flex-row bg-gray-100 rounded-xl p-1">
          {(['upcoming', 'past'] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg items-center ${tab === t ? 'bg-white shadow-sm' : ''}`}
            >
              <Text className={`font-semibold text-sm capitalize ${tab === t ? 'text-text-primary' : 'text-text-secondary'}`}>
                {t} {t === 'upcoming' ? `(${upcoming.length})` : `(${past.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <BookingCard booking={item} currentUserId={user?.id ?? ''} />
          )}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center py-20 px-8">
              <Text className="text-5xl mb-4">{tab === 'upcoming' ? '📅' : '📋'}</Text>
              <Text className="text-text-primary font-bold text-xl text-center mb-2">
                No {tab} bookings
              </Text>
              <Text className="text-text-secondary text-center">
                {tab === 'upcoming'
                  ? 'Find a buddy and book an activity!'
                  : 'Your completed bookings will appear here.'}
              </Text>
              {tab === 'upcoming' && (
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/discover')}
                  className="mt-4 bg-primary px-6 py-3 rounded-full"
                >
                  <Text className="text-white font-semibold">Find a Buddy</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}
