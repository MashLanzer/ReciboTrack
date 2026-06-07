import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { Avatar } from '@/components/ui/Avatar';
import { ChatBubble } from '@/components/ChatBubble';
import { BookingModal } from '@/components/BookingModal';
import { useAuthStore } from '@/stores/authStore';
import { useBookingStore } from '@/stores/bookingStore';
import { supabase } from '@/lib/supabase';
import type { Message, Profile } from '@/types';

function DateSeparator({ date }: { date: string }) {
  const d = new Date(date);
  const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMM d, yyyy');
  return (
    <View className="flex-row items-center gap-3 my-4 px-4">
      <View className="flex-1 h-px bg-gray-200" />
      <Text className="text-text-secondary text-xs font-medium">{label}</Text>
      <View className="flex-1 h-px bg-gray-200" />
    </View>
  );
}

export default function ChatScreen() {
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { createBooking, confirmBooking } = useBookingStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!matchId || !user?.id) return;
    loadChat();

    const sub = supabase
      .channel(`chat-${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
          markRead();
        }
      )
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, [matchId, user?.id]);

  const loadChat = async () => {
    if (!matchId || !user?.id) return;
    try {
      // Load match + other user
      const { data: match } = await supabase
        .from('matches')
        .select(`
          user_id_1, user_id_2,
          profile1:profiles!matches_user_id_1_fkey(*),
          profile2:profiles!matches_user_id_2_fkey(*)
        `)
        .eq('id', matchId)
        .single();

      if (match) {
        setOtherUser(match.user_id_1 === user.id ? match.profile2 : match.profile1);
      }

      // Load messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      setMessages((msgs ?? []) as Message[]);
      await markRead();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const markRead = async () => {
    if (!matchId || !user?.id) return;
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('match_id', matchId)
      .neq('sender_id', user.id);
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !matchId || !user?.id || isSending) return;
    const content = input.trim();
    setInput('');
    setIsSending(true);
    try {
      await supabase.from('messages').insert({
        match_id: matchId,
        sender_id: user.id,
        content,
        message_type: 'text',
      });
    } catch (e) {
      console.error(e);
      setInput(content);
    } finally {
      setIsSending(false);
    }
  }, [input, matchId, user?.id, isSending]);

  const handleBookingConfirm = async (bookingInput: any) => {
    setShowBooking(false);
    if (!matchId || !user?.id) return;
    try {
      const { bookingId, clientSecret } = await createBooking(bookingInput);
      // Send booking request as message
      await supabase.from('messages').insert({
        match_id: matchId,
        sender_id: user.id,
        content: `Booking request for ${bookingInput.activity}`,
        message_type: 'booking_request',
        metadata: {
          ...bookingInput,
          bookingId,
          clientSecret,
          status: 'pending',
        },
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Group messages by date for separators
  const messagesWithDates = messages.reduce<(Message | { type: 'separator'; date: string })[]>((acc, msg, i) => {
    const prev = messages[i - 1];
    if (!prev || format(new Date(prev.createdAt), 'yyyy-MM-dd') !== format(new Date(msg.createdAt), 'yyyy-MM-dd')) {
      acc.push({ type: 'separator', date: msg.createdAt });
    }
    acc.push(msg);
    return acc;
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100 bg-white gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        {otherUser && (
          <>
            <Avatar
              source={otherUser.photos?.[0] ? { uri: otherUser.photos[0] } : null}
              name={otherUser.name}
              size="sm"
              isOnline={otherUser.isOnline}
            />
            <View className="flex-1">
              <Text className="text-text-primary font-semibold text-base">{otherUser.name}</Text>
              <Text className="text-text-secondary text-xs">
                {otherUser.isOnline ? '🟢 Online' : 'Last seen recently'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowBooking(true)}
              className="bg-primary/10 px-3 py-1.5 rounded-full flex-row items-center gap-1"
            >
              <Ionicons name="calendar-outline" size={14} color="#FF6B35" />
              <Text className="text-primary text-xs font-semibold">Book</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messagesWithDates}
          keyExtractor={(item, i) => ('id' in item ? item.id : `sep-${i}`)}
          renderItem={({ item }) => {
            if ('type' in item) return <DateSeparator date={item.date} />;
            return (
              <ChatBubble
                message={item as Message}
                isOwn={(item as Message).senderId === user?.id}
              />
            );
          }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center py-10">
              <Text className="text-4xl mb-3">👋</Text>
              <Text className="text-text-secondary text-center text-sm">
                You matched! Say hi to {otherUser?.name?.split(' ')[0]}.
              </Text>
            </View>
          )}
        />

        {/* Input Bar */}
        <View className="flex-row items-end px-4 py-3 border-t border-gray-100 bg-white gap-2">
          <View className="flex-1 bg-surface rounded-2xl border border-gray-200 px-4 py-2.5 min-h-[44px] max-h-[120px]">
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={`Message ${otherUser?.name?.split(' ')[0] ?? 'your buddy'}...`}
              multiline
              className="text-text-primary text-sm leading-5"
              placeholderTextColor="#9CA3AF"
              onSubmitEditing={sendMessage}
            />
          </View>
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!input.trim() || isSending}
            className={`w-11 h-11 rounded-full items-center justify-center ${input.trim() && !isSending ? 'bg-primary' : 'bg-gray-200'}`}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={18} color={input.trim() ? 'white' : '#9CA3AF'} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Booking Modal */}
      {otherUser && (
        <BookingModal
          visible={showBooking}
          buddy={otherUser}
          onClose={() => setShowBooking(false)}
          onConfirm={handleBookingConfirm}
        />
      )}
    </SafeAreaView>
  );
}
