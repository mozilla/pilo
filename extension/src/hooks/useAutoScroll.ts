import { useEffect, useRef, useCallback } from "react";
import { useConversationStore } from "../stores/conversationStore";
import type { ChatMessage } from "./useConversation";

/**
 * Hook for managing auto-scroll behavior in chat interfaces
 *
 * This hook handles scroll position detection and auto-scrolling to bottom
 * for chat message lists. It automatically manages scroll state persistence
 * and provides smooth scrolling behavior.
 *
 * @param messages - Array of chat messages to monitor for changes
 * @param tabId - Optional tab ID for persisting scroll state
 * @returns Object containing refs and scroll handlers
 *
 * @example
 * ```typescript
 * const autoScroll = useAutoScroll(messages, tabId);
 *
 * // Use in JSX
 * <div ref={autoScroll.scrollContainerRef} onScroll={autoScroll.handleScroll}>
 *   {messages.map(msg => <div key={msg.id}>{msg.content}</div>)}
 *   <div ref={autoScroll.messagesEndRef} />
 * </div>
 *
 * // Manually trigger scroll
 * autoScroll.scrollToBottom();
 * ```
 */
export function useAutoScroll(messages: ChatMessage[], tabId?: number) {
  const store = useConversationStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Get current scroll state from conversation
  const conversation = tabId ? store.getConversation(tabId) : null;
  const isAtBottom = conversation?.isAtBottom ?? true;

  const scrollToBottom = useCallback(
    (instant = false) => {
      if (messagesEndRef.current && isAtBottom) {
        messagesEndRef.current.scrollIntoView({ behavior: instant ? "instant" : "smooth" });
      }
    },
    [isAtBottom],
  );

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current && tabId) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
      store.setScrollState(tabId, isNearBottom);
    }
  }, [store, tabId]);

  // Auto-scroll when messages change (instant on tab switch, smooth on new messages)
  useEffect(() => {
    // Use instant scroll when switching tabs (messages array changes completely)
    scrollToBottom(true);
  }, [messages, scrollToBottom]);

  // Auto-scroll for new messages with a slight delay
  const scrollToBottomOnNewMessage = useCallback(() => {
    setTimeout(() => {
      if (isAtBottom && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  }, [isAtBottom]);

  return {
    messagesEndRef,
    scrollContainerRef,
    handleScroll,
    scrollToBottom,
    scrollToBottomOnNewMessage,
    isAtBottom,
  };
}
