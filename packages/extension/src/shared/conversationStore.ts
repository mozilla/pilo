import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import browser from "webextension-polyfill";
import type { ChatMessage } from "../ui/hooks/useChat";
import { reviver } from "./utils/storage";

export interface Conversation {
  id: string;
  tabId: number;
  messages: ChatMessage[];
  currentTaskId: string | null;
  isExecuting: boolean;
  isAtBottom: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationStore {
  conversations: Record<string, Conversation>;

  // Actions
  createConversation: (tabId: number) => Conversation;
  getConversation: (tabId: number) => Conversation | null;
  updateConversation: (
    tabId: number,
    updates: Partial<Omit<Conversation, "id" | "tabId" | "createdAt">>,
  ) => void;
  addMessage: (tabId: number, message: ChatMessage) => void;
  setExecutionState: (tabId: number, isExecuting: boolean) => void;
  setTaskId: (tabId: number, taskId: string | null) => void;
  setScrollState: (tabId: number, isAtBottom: boolean) => void;
  clearMessages: (tabId: number) => void;
  deleteConversation: (tabId: number) => void;
  cleanupClosedTabs: (activeTabIds: number[]) => void;
}

// Create browser storage adapter for Zustand
const browserStorage = createJSONStorage(
  () => ({
    getItem: async (name: string): Promise<string | null> => {
      const result = await browser.storage.local.get(name);
      const value = result[name];
      return typeof value === "string" ? value : null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
      await browser.storage.local.set({ [name]: value });
    },
    removeItem: async (name: string): Promise<void> => {
      await browser.storage.local.remove(name);
    },
  }),
  {
    reviver,
  },
);

const createConversationId = (tabId: number) => `tab_${tabId}`;

const createNewConversation = (tabId: number): Conversation => ({
  id: createConversationId(tabId),
  tabId,
  messages: [],
  currentTaskId: null,
  isExecuting: false,
  isAtBottom: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
      conversations: {},

      createConversation: (tabId: number) => {
        const conversation = createNewConversation(tabId);
        set((state) => ({
          conversations: {
            ...state.conversations,
            [conversation.id]: conversation,
          },
        }));
        return conversation;
      },

      getConversation: (tabId: number) => {
        const id = createConversationId(tabId);
        return get().conversations[id] || null;
      },

      updateConversation: (
        tabId: number,
        updates: Partial<Omit<Conversation, "id" | "tabId" | "createdAt">>,
      ) => {
        const id = createConversationId(tabId);
        set((state) => {
          const conversation = state.conversations[id];
          if (!conversation) return state;

          return {
            conversations: {
              ...state.conversations,
              [id]: {
                ...conversation,
                ...updates,
                updatedAt: new Date(),
              },
            },
          };
        });
      },

      addMessage: (tabId: number, message: ChatMessage) => {
        const id = createConversationId(tabId);
        set((state) => {
          let conversation = state.conversations[id];
          if (!conversation) {
            conversation = createNewConversation(tabId);
          }

          return {
            conversations: {
              ...state.conversations,
              [id]: {
                ...conversation,
                messages: [...conversation.messages, message],
                updatedAt: new Date(),
              },
            },
          };
        });
      },

      setExecutionState: (tabId: number, isExecuting: boolean) => {
        get().updateConversation(tabId, { isExecuting });
      },

      setTaskId: (tabId: number, taskId: string | null) => {
        get().updateConversation(tabId, { currentTaskId: taskId });
      },

      setScrollState: (tabId: number, isAtBottom: boolean) => {
        get().updateConversation(tabId, { isAtBottom });
      },

      clearMessages: (tabId: number) => {
        get().updateConversation(tabId, {
          messages: [],
          currentTaskId: null,
          isExecuting: false,
        });
      },

      deleteConversation: (tabId: number) => {
        const id = createConversationId(tabId);
        set((state) => {
          const { [id]: deleted, ...rest } = state.conversations;
          return { conversations: rest };
        });
      },

      cleanupClosedTabs: (activeTabIds: number[]) => {
        const activeTabIdSet = new Set(activeTabIds);
        set((state) => {
          const filteredConversations: Record<string, Conversation> = {};

          Object.values(state.conversations).forEach((conversation) => {
            if (activeTabIdSet.has(conversation.tabId)) {
              filteredConversations[conversation.id] = conversation;
            }
          });

          return { conversations: filteredConversations };
        });
      },
    }),
    {
      name: "spark-conversations",
      storage: browserStorage,
    },
  ),
);

// Hook to get or create conversation for a tab
export const useTabConversation = (tabId: number | null) => {
  const store = useConversationStore();

  if (!tabId) return null;

  let conversation = store.getConversation(tabId);
  if (!conversation) {
    conversation = store.createConversation(tabId);
  }

  return conversation;
};
