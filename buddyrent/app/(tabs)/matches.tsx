import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import type { Match, Profile } from '@/types';
import { formatRelativeTime } from '@/lib/utils';

interface MatchWithProfile extends Match {
  otherUser: Profile;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

export default function MatchesScreen() {
  const { user } = useAuthStore();
  const [matches, setMatches] = useState<MatchWithProfile[]>([]);
  const [newMatches, setNewMatches] = useState<MatchWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    loadMatches();

    const subscription = supabase
      .channel('matches')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, () => loadMatches())
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [user?.id]);

  const loadMatches = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          profile1:profiles!matches_user_id_1_fkey(*),
          profile2:profiles!matches_user_id_2_fkey(*)
        `)
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: MatchWithProfile[] = (data ?? []).map((m: any) => ({
        ...m,
        otherUser: m.user_id_1 === user.id ? m.profile2 : m.profile1,
      }));

      setNewMatches(formatted.filter(m => !m.lastMessage));
      setMatches(formatted.filter(m => m.lastMessage));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const goToChat = (matchId: string) => router.push(`/(tabs)/messages/${matchId}`);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="px-4 py-3">
        <Text className="text-text-primary font-bold text-2xl" style={{ fontFamily: 'Poppins' }}>Matches</Text>
      </View>

      <FlatList
        data={matches}
        keyExtractor={item => item.id}
        ListHeaderComponent={() => (
          <>
            {newMatches.length > 0 && (
              <View className="mb-4">
                <Text className="px-4 text-text-primary font-semibold text-base mb-3">
                  New Matches 🎉 ({newMatches.length})
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                  {newMatches.map(match => (
                    <TouchableOpacity
                      key={match.id}
                      onPress={() => goToChat(match.id)}
                      className="items-center mr-4"
                    >
                      <View className="relative">
                        <Avatar
                          source={match.otherUser.photos?.[0] ? { uri: match.otherUser.photos[0] } : null}
                          name={match.otherUser.name}
                          size="lg"
                        />
                        <View className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full border-2 border-white" />
                      </View>
                      <Text className="text-text-primary text-xs font-medium mt-1.5 max-w-[60px] text-center" numberOfLines={1}>
                        {match.otherUser.name.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {matches.length > 0 && (
              <Text className="px-4 text-text-primary font-semibold text-base mb-2">Messages</Text>
            )}
          </>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => goToChat(item.id)}
            className="flex-row items-center px-4 py-3 gap-3 bg-white mx-4 mb-2 rounded-2xl border border-gray-50"
          >
            <Avatar
              source={item.otherUser.photos?.[0] ? { uri: item.otherUser.photos[0] } : null}
              name={item.otherUser.name}
              size="md"
              isOnline={item.otherUser.isOnline}
            />
            <View className="flex-1">
              <View className="flex-row items-center justify-between mb-0.5">
                <Text className="text-text-primary font-semibold text-base">{item.otherUser.name}</Text>
                {item.lastMessageTime && (
                  <Text className="text-text-secondary text-xs">{formatRelativeTime(item.lastMessageTime)}</Text>
                )}
              </View>
              <Text className="text-text-secondary text-sm" numberOfLines={1}>
                {item.lastMessage ?? `Say hi to ${item.otherUser.name.split(' ')[0]}! 👋`}
              </Text>
            </View>
            {(item.unreadCount ?? 0) > 0 && (
              <View className="bg-primary rounded-full w-5 h-5 items-center justify-center">
                <Text className="text-white text-xs font-bold">{item.unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center py-20 px-8">
            <Text className="text-5xl mb-4">💫</Text>
            <Text className="text-text-primary font-bold text-xl text-center mb-2">No matches yet</Text>
            <Text className="text-text-secondary text-center">
              Keep swiping to find your perfect activity buddy!
            </Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}
