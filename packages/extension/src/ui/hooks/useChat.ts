import { useCallback } from "react";
import { useConversation } from "./useConversation";
import { useAutoScroll } from "./useAutoScroll";
import type { ChatMessage } from "./useConversation";

// Re-export ChatMessage type for backwards compatibility
export type { ChatMessage };

/**
 * @deprecated Use useConversation and useAutoScroll hooks directly instead
 *
 * Legacy hook that combines conversation data and scroll behavior
 * Kept for backwards compatibility, but prefer the separate hooks
 */
export function useChat(tabId?: number) {
  const conversation = useConversation(tabId);
  const autoScroll = useAutoScroll(conversation.messages, tabId);

  // Enhanced addMessage that includes auto-scroll
  const addMessage = useCallback(
    (type: Parameters<typeof conversation.addMessage>[0], content: string, taskId?: string) => {
      conversation.addMessage(type, content, taskId);
      autoScroll.scrollToBottomOnNewMessage();
    },
    [conversation, autoScroll],
  );

  // Legacy switchToTab (now a no-op since tab switching is handled by parent)
  const switchToTab = useCallback((_newTabId: number) => {
    // This is now handled by the parent component passing a new tabId
    // The conversation will be automatically created/loaded by useTabConversation
  }, []);

  return {
    // Conversation data
    messages: conversation.messages,
    currentTaskId: conversation.currentTaskId,
    currentTabId: conversation.currentTabId,
    isExecuting: conversation.isExecuting,
    conversation: conversation.conversation,

    // Conversation actions
    addMessage,
    startTask: conversation.startTask,
    endTask: conversation.endTask,
    clearMessages: conversation.clearMessages,
    setExecutionState: conversation.setExecutionState,

    // Auto-scroll
    messagesEndRef: autoScroll.messagesEndRef,
    scrollContainerRef: autoScroll.scrollContainerRef,
    handleScroll: autoScroll.handleScroll,
    isAtBottom: autoScroll.isAtBottom,

    // Legacy
    switchToTab,
  };
}
