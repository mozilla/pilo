import { useCallback } from "react";
import { useConversationStore, useTabConversation } from "../../shared/conversationStore";

export interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "system" | "reasoning" | "result" | "status" | "plan" | "error";
  content: string;
  timestamp: Date;
  taskId?: string; // Group messages by task
}

/**
 * Hook for managing conversation data and actions
 *
 * This hook provides a clean interface to the conversation store for a specific tab.
 * It handles creating conversations automatically and provides all necessary actions
 * for managing conversation state.
 *
 * @param tabId - The browser tab ID to get/create a conversation for
 * @returns Object containing conversation data and actions
 *
 * @example
 * ```typescript
 * const conversation = useConversation(123);
 *
 * // Add a message
 * conversation.addMessage("user", "Hello!");
 *
 * // Start a task
 * const taskId = conversation.startTask();
 *
 * // Set execution state
 * conversation.setExecutionState(true);
 * ```
 */
export function useConversation(tabId?: number) {
  const store = useConversationStore();
  const conversation = useTabConversation(tabId || null);

  // Derived state from conversation
  const messages = conversation?.messages || [];
  const currentTaskId = conversation?.currentTaskId || null;
  const isExecuting = conversation?.isExecuting || false;
  const currentTabId = conversation?.tabId || null;

  // Message actions
  const addMessage = useCallback(
    (type: ChatMessage["type"], content: string, taskId?: string) => {
      if (!currentTabId) return;

      const newMessage: ChatMessage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type,
        content,
        timestamp: new Date(),
        taskId,
      };

      store.addMessage(currentTabId, newMessage);
    },
    [store, currentTabId],
  );

  const clearMessages = useCallback(() => {
    if (!currentTabId) return;
    store.clearMessages(currentTabId);
  }, [store, currentTabId]);

  // Task actions
  const startTask = useCallback(() => {
    if (!currentTabId) return "";

    const taskId = Date.now().toString();
    store.setTaskId(currentTabId, taskId);
    return taskId;
  }, [store, currentTabId]);

  const endTask = useCallback(() => {
    if (!currentTabId) return;
    store.setTaskId(currentTabId, null);
  }, [store, currentTabId]);

  // Execution state actions
  const setExecutionState = useCallback(
    (executing: boolean) => {
      if (!currentTabId) return;
      store.setExecutionState(currentTabId, executing);
    },
    [store, currentTabId],
  );

  return {
    // Data
    messages,
    currentTaskId,
    currentTabId,
    isExecuting,
    conversation,

    // Actions
    addMessage,
    clearMessages,
    startTask,
    endTask,
    setExecutionState,
  };
}
