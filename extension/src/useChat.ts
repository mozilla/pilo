import { useState, useEffect, useRef, useCallback } from "react";

export interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "system" | "reasoning" | "result" | "status" | "plan" | "error";
  content: string;
  timestamp: Date;
  taskId?: string; // Group messages by task
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current && isAtBottom) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [isAtBottom]);

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
      setIsAtBottom(isNearBottom);
    }
  }, []);

  const addMessage = useCallback(
    (type: ChatMessage["type"], content: string, taskId?: string) => {
      const newMessage: ChatMessage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        type,
        content,
        timestamp: new Date(),
        taskId,
      };
      setMessages((prev) => [...prev, newMessage]);

      // Auto-scroll to bottom for new messages
      setTimeout(() => {
        if (isAtBottom && messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    },
    [isAtBottom],
  );

  const startTask = useCallback(() => {
    const taskId = Date.now().toString();
    setCurrentTaskId(taskId);
    return taskId;
  }, []);

  const endTask = useCallback(() => {
    setCurrentTaskId(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentTaskId(null);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return {
    messages,
    addMessage,
    startTask,
    endTask,
    clearMessages,
    messagesEndRef,
    scrollContainerRef,
    handleScroll,
    isAtBottom,
    currentTaskId,
  };
}
