import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { formatRelativeTime } from '@/lib/utils';
import type { Profile } from '@/types';

interface Conversation {
  matchId: string;
  otherUser: Profile;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export default function MessagesScreen() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filtered, setFiltered] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    loadConversations();
    const sub = supabase
      .channel('messages-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, loadConversations)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [user?.id]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(conversations);
    } else {
      setFiltered(conversations.filter(c =>
        c.otherUser.name.toLowerCase().includes(search.toLowerCase())
      ));
    }
  }, [search, conversations]);

  const loadConversations = async () => {
    if (!user?.id) return;
    try {
      const { data: matches } = await supabase
        .from('matches')
        .select(`
          id,
          profile1:profiles!matches_user_id_1_fkey(id, name, photos, is_online),
          profile2:profiles!matches_user_id_2_fkey(id, name, photos, is_online)
        `)
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

      if (!matches) return;

      const convs: Conversation[] = await Promise.all(
        matches.map(async (m: any) => {
          const otherUser = m.profile1?.id === user.id ? m.profile2 : m.profile1;
          const { data: msgs } = await supabase
            .from('messages')
            .select('content, created_at, is_read, sender_id')
            .eq('match_id', m.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const lastMsg = msgs?.[0];
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('match_id', m.id)
            .eq('is_read', false)
            .neq('sender_id', user.id);

          return {
            matchId: m.id,
            otherUser,
            lastMessage: lastMsg?.content ?? '',
            lastMessageTime: lastMsg?.created_at ?? m.created_at,
            unreadCount: count ?? 0,
          };
        })
      );

      const sorted = convs.sort((a, b) =>
        new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      );
      setConversations(sorted);
      setFiltered(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="px-4 pt-3 pb-2">
        <Text className="text-text-primary font-bold text-2xl mb-3" style={{ fontFamily: 'Poppins' }}>
          Messages
        </Text>
        <View className="flex-row items-center bg-white rounded-xl border border-gray-200 px-3 py-2 gap-2">
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search conversations..."
            className="flex-1 text-text-primary text-sm"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.matchId}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/(tabs)/messages/${item.matchId}`)}
              className="flex-row items-center px-4 py-3 gap-3"
            >
              <Avatar
                source={item.otherUser.photos?.[0] ? { uri: item.otherUser.photos[0] } : null}
                name={item.otherUser.name}
                size="md"
                isOnline={item.otherUser.isOnline}
              />
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text className={`text-base ${item.unreadCount > 0 ? 'font-bold text-text-primary' : 'font-semibold text-text-primary'}`}>
                    {item.otherUser.name}
                  </Text>
                  <Text className="text-text-secondary text-xs">{formatRelativeTime(item.lastMessageTime)}</Text>
                </View>
                <Text
                  className={`text-sm ${item.unreadCount > 0 ? 'text-text-primary font-medium' : 'text-text-secondary'}`}
                  numberOfLines={1}
                >
                  {item.lastMessage || `Say hi to ${item.otherUser.name.split(' ')[0]}! 👋`}
                </Text>
              </View>
              {item.unreadCount > 0 && (
                <View className="bg-primary rounded-full w-5 h-5 items-center justify-center">
                  <Text className="text-white text-xs font-bold">{item.unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View className="h-px bg-gray-100 ml-[72px]" />}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center py-20 px-8">
              <Text className="text-5xl mb-4">💬</Text>
              <Text className="text-text-primary font-bold text-xl text-center mb-2">No messages yet</Text>
              <Text className="text-text-secondary text-center">Match with a buddy to start chatting!</Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
