import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { ActivityBadge } from '@/components/ActivityBadge';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import Colors from '@/constants/colors';

function StarRating({ rating }: { rating: number }) {
  return (
    <View className="flex-row items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <Text key={star} className="text-base">
          {star <= Math.round(rating) ? '⭐' : '☆'}
        </Text>
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuthStore();
  const [photoIndex, setPhotoIndex] = useState(0);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  if (!profile) return null;

  const isBuddy = profile.role === 'buddy' || profile.role === 'both';

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-text-primary font-bold text-2xl" style={{ fontFamily: 'Poppins' }}>
            My Profile
          </Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile/edit')}
              className="w-10 h-10 bg-white rounded-full items-center justify-center border border-gray-100"
            >
              <Ionicons name="pencil-outline" size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSignOut}
              className="w-10 h-10 bg-white rounded-full items-center justify-center border border-gray-100"
            >
              <Ionicons name="settings-outline" size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Photos */}
        {profile.photos && profile.photos.length > 0 ? (
          <View className="mx-4 rounded-3xl overflow-hidden h-80 mb-4">
            <Image
              source={{ uri: profile.photos[photoIndex] }}
              className="w-full h-full"
              resizeMode="cover"
            />
            {profile.photos.length > 1 && (
              <View className="absolute bottom-3 w-full flex-row justify-center gap-1.5">
                {profile.photos.map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setPhotoIndex(i)}
                    className={`rounded-full ${i === photoIndex ? 'bg-white w-5 h-1.5' : 'bg-white/60 w-1.5 h-1.5'}`}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View className="mx-4 rounded-3xl bg-gray-100 h-60 mb-4 items-center justify-center">
            <Avatar source={null} name={profile.name} size="xl" />
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile/edit')}
              className="mt-3 flex-row items-center gap-1"
            >
              <Ionicons name="add-circle-outline" size={16} color="#FF6B35" />
              <Text className="text-primary text-sm font-semibold">Add Photos</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Profile Info */}
        <View className="px-4">
          <View className="flex-row items-start justify-between mb-2">
            <View>
              <View className="flex-row items-center gap-2">
                <Text className="text-text-primary font-bold text-2xl">{profile.name}</Text>
                {profile.isVerified && <Text className="text-base">✅</Text>}
              </View>
              <Text className="text-text-secondary">
                {profile.age} years old {profile.location ? `• ${profile.location}` : ''}
              </Text>
            </View>
            <View className={`px-3 py-1 rounded-full ${
              profile.role === 'buddy' ? 'bg-primary/10' :
              profile.role === 'seeker' ? 'bg-secondary/10' :
              'bg-accent/10'
            }`}>
              <Text className={`text-xs font-semibold capitalize ${
                profile.role === 'buddy' ? 'text-primary' :
                profile.role === 'seeker' ? 'text-secondary' :
                'text-accent'
              }`}>{profile.role}</Text>
            </View>
          </View>

          {/* Rating */}
          {profile.reviewCount > 0 && (
            <View className="flex-row items-center gap-2 mb-3">
              <StarRating rating={profile.rating ?? 0} />
              <Text className="text-text-secondary text-sm">
                {profile.rating?.toFixed(1)} ({profile.reviewCount} reviews)
              </Text>
            </View>
          )}

          {/* Hourly Rate (buddy) */}
          {isBuddy && profile.hourlyRate && (
            <View className="bg-primary/10 rounded-xl px-4 py-3 mb-4 flex-row items-center justify-between">
              <Text className="text-primary font-semibold">Your hourly rate</Text>
              <Text className="text-primary font-bold text-xl">${profile.hourlyRate}/hr</Text>
            </View>
          )}

          {/* Bio */}
          {profile.bio ? (
            <View className="mb-4">
              <Text className="text-text-primary font-semibold text-base mb-2">About me</Text>
              <Text className="text-text-secondary leading-6">{profile.bio}</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile/edit')}
              className="bg-gray-100 rounded-xl px-4 py-3 mb-4 flex-row items-center gap-2"
            >
              <Ionicons name="add-circle-outline" size={18} color="#9CA3AF" />
              <Text className="text-text-secondary text-sm">Add a bio to attract more matches</Text>
            </TouchableOpacity>
          )}

          {/* Activities */}
          {profile.activities && profile.activities.length > 0 && (
            <View className="mb-4">
              <Text className="text-text-primary font-semibold text-base mb-2">Activities</Text>
              <View className="flex-row flex-wrap gap-2">
                {profile.activities.map((actId: string) => (
                  <ActivityBadge key={actId} activityId={actId} />
                ))}
              </View>
            </View>
          )}

          {/* Verification Status */}
          <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <Text className="text-text-primary font-semibold text-base mb-3">Verification</Text>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className={`w-8 h-8 rounded-full items-center justify-center ${profile.isVerified ? 'bg-success/20' : 'bg-gray-100'}`}>
                  <Ionicons name={profile.isVerified ? 'checkmark' : 'id-card-outline'} size={16} color={profile.isVerified ? '#10B981' : '#9CA3AF'} />
                </View>
                <Text className="text-text-primary font-medium">Identity Verified</Text>
              </View>
              {profile.isVerified ? (
                <Text className="text-success text-sm font-semibold">✓ Verified</Text>
              ) : (
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/onboarding/step4')}
                  className="bg-primary/10 px-3 py-1 rounded-full"
                >
                  <Text className="text-primary text-xs font-semibold">Verify Now</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Sign Out */}
          <Button variant="outline" onPress={handleSignOut} className="mb-8">
            Sign Out
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
