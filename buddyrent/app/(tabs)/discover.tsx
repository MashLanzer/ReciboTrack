import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SwipeDeck } from '@/components/SwipeDeck';
import { useDiscoverStore } from '@/stores/discoverStore';
import { useAuthStore } from '@/stores/authStore';
import Colors from '@/constants/colors';
import { ACTIVITIES } from '@/constants/activities';

export default function DiscoverScreen() {
  const { user } = useAuthStore();
  const { profiles, isLoading, loadProfiles, swipeLeft, swipeRight, superLike, filters, updateFilters } = useDiscoverStore();
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (user?.id) loadProfiles(user.id);
  }, [user?.id]);

  const handleSwipeLeft = (id: string) => swipeLeft(id);
  const handleSwipeRight = (id: string) => swipeRight(id);
  const handleSuperLike = (id: string) => superLike(id);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 bg-primary rounded-full items-center justify-center">
            <Text className="text-white font-bold text-sm">B</Text>
          </View>
          <Text className="text-text-primary font-bold text-xl" style={{ fontFamily: 'Poppins' }}>
            BuddyRent
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowFilters(true)}
          className="w-10 h-10 bg-white rounded-full items-center justify-center border border-gray-100 shadow-sm"
        >
          <Ionicons name="options-outline" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Swipe Deck */}
      <View className="flex-1">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
            <Text className="text-text-secondary mt-3">Finding buddies near you...</Text>
          </View>
        ) : profiles.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-5xl mb-4">🔍</Text>
            <Text className="text-text-primary font-bold text-xl text-center mb-2">No more buddies!</Text>
            <Text className="text-text-secondary text-center mb-6">
              You've seen everyone nearby. Try expanding your filters or check back later.
            </Text>
            <TouchableOpacity
              onPress={() => user?.id && loadProfiles(user.id)}
              className="bg-primary px-6 py-3 rounded-full"
            >
              <Text className="text-white font-semibold">Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <SwipeDeck
            profiles={profiles}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            onSuperLike={handleSuperLike}
          />
        )}
      </View>

      {/* Action Buttons */}
      {profiles.length > 0 && !isLoading && (
        <View className="flex-row items-center justify-center gap-6 pb-6 px-4">
          <TouchableOpacity
            onPress={() => profiles[0] && handleSwipeLeft(profiles[0].id)}
            className="w-16 h-16 bg-white rounded-full items-center justify-center shadow-md border border-gray-100"
          >
            <Text className="text-2xl">✕</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => profiles[0] && handleSuperLike(profiles[0].id)}
            className="w-14 h-14 bg-white rounded-full items-center justify-center shadow-md border border-gray-100"
          >
            <Text className="text-xl">⭐</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => profiles[0] && handleSwipeRight(profiles[0].id)}
            className="w-16 h-16 bg-primary rounded-full items-center justify-center shadow-md"
          >
            <Text className="text-2xl">❤️</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filters Modal */}
      <Modal visible={showFilters} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Text className="text-text-secondary">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-text-primary font-semibold text-base">Filters</Text>
            <TouchableOpacity onPress={() => {
              updateFilters({ minAge: 18, maxAge: 35, maxHourlyRate: 100, maxDistance: 25 });
              setShowFilters(false);
            }}>
              <Text className="text-primary font-semibold">Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-4 py-4">
            <View className="mb-6">
              <Text className="text-text-primary font-semibold text-base mb-3">Age Range</Text>
              <Text className="text-text-secondary text-sm mb-2">
                {filters.minAge ?? 18} – {filters.maxAge ?? 35} years
              </Text>
              <View className="flex-row gap-3">
                {[18, 21, 25].map(age => (
                  <TouchableOpacity
                    key={age}
                    onPress={() => updateFilters({ minAge: age })}
                    className={`flex-1 py-2 rounded-xl border-2 items-center ${(filters.minAge ?? 18) === age ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
                  >
                    <Text className={`font-medium text-sm ${(filters.minAge ?? 18) === age ? 'text-white' : 'text-text-primary'}`}>{age}+</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="mb-6">
              <Text className="text-text-primary font-semibold text-base mb-3">Max Hourly Rate</Text>
              {[25, 50, 75, 100].map(rate => (
                <TouchableOpacity
                  key={rate}
                  onPress={() => updateFilters({ maxHourlyRate: rate })}
                  className={`flex-row items-center justify-between px-4 py-3 rounded-xl mb-2 border-2 ${(filters.maxHourlyRate ?? 100) === rate ? 'bg-primary/10 border-primary' : 'bg-white border-gray-200'}`}
                >
                  <Text className="text-text-primary font-medium">Up to ${rate}/hr</Text>
                  {(filters.maxHourlyRate ?? 100) === rate && <Ionicons name="checkmark-circle" size={20} color={Colors.primary.DEFAULT} />}
                </TouchableOpacity>
              ))}
            </View>

            <View className="mb-6">
              <Text className="text-text-primary font-semibold text-base mb-3">Activities</Text>
              <View className="flex-row flex-wrap gap-2">
                {ACTIVITIES.slice(0, 15).map(activity => {
                  const isSelected = filters.activities?.includes(activity.id);
                  return (
                    <TouchableOpacity
                      key={activity.id}
                      onPress={() => {
                        const current = filters.activities ?? [];
                        updateFilters({
                          activities: isSelected
                            ? current.filter(a => a !== activity.id)
                            : [...current, activity.id],
                        });
                      }}
                      className={`flex-row items-center gap-1 px-3 py-2 rounded-full border-2 ${isSelected ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
                    >
                      <Text className="text-sm">{activity.emoji}</Text>
                      <Text className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-text-primary'}`}>{activity.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View className="px-4 py-4 border-t border-gray-100">
            <TouchableOpacity
              onPress={() => {
                if (user?.id) loadProfiles(user.id);
                setShowFilters(false);
              }}
              className="bg-primary py-4 rounded-2xl items-center"
            >
              <Text className="text-white font-bold text-base">Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
