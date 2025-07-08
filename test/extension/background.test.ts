import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { AgentAPI } from '../../extension/src/AgentAPI';

// Helper to create a mock event emitter
const createEventEmitter = <T extends (...args: any[]) => any>() => {
  const listeners: T[] = [];
  return {
    addListener: vi.fn((listener: T) => listeners.push(listener)),
    async fire(...args: Parameters<T>) {
      const results = [];
      for (const listener of listeners) {
        results.push(await listener(...args));
      }
      // Return the first non-undefined result, which mimics how some browser APIs behave
      return results.find(r => r !== undefined);
    },
    clear: () => listeners.splice(0, listeners.length),
    getListenerCount: () => listeners.length,
  };
};

const browser = {
  runtime: {
    onMessage: createEventEmitter(),
    sendMessage: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn(),
    },
  },
  action: {
    onClicked: createEventEmitter(),
  },
  sidePanel: {
    open: vi.fn(),
  },
  sidebarAction: {
    open: vi.fn(),
  }
};

vi.stubGlobal('browser', browser);
vi.stubGlobal('defineBackground', (callback) => callback());

vi.mock('../../extension/src/AgentAPI', () => ({
  AgentAPI: {
    runTask: vi.fn(),
  },
  EventStoreLogger: vi.fn().mockImplementation(() => ({
    getEvents: vi.fn().mockReturnValue([]),
    log: vi.fn(),
  })),
}));

describe('background script', () => {
  beforeEach(async () => {
    // Reset modules to get a fresh background script instance for each test
    vi.resetModules();
    // Clear all mocks and event listeners
    vi.clearAllMocks();
    browser.runtime.onMessage.clear();
    browser.action.onClicked.clear();
    
    browser.storage.local.get.mockResolvedValue({ apiKey: 'test-key' });
    // Import the background script to attach its listeners
    await import('../../extension/entrypoints/background');
  });

  describe('message handler', () => {
    it('should handle errors during task execution and still return events', async () => {
      const errorMessage = 'Task failed!';
      (AgentAPI.runTask as Mock).mockRejectedValue(new Error(errorMessage));

      const message = {
        type: 'executeTask',
        task: 'test task',
        tabId: 1,
        startUrl: 'http://example.com',
      };

      // Fire the event and wait for the response from the listener
      const response = await browser.runtime.onMessage.fire(message, {});

      expect(response).toEqual(
        expect.objectContaining({
          success: false,
          message: `Task execution failed: ${errorMessage}`,
          events: [],
        })
      );
    });

    it('should handle non-Error objects thrown during task execution', async () => {
      const errorMessage = 'A string error';
      (AgentAPI.runTask as Mock).mockRejectedValue(errorMessage);

      const message = {
        type: 'executeTask',
        task: 'test task',
        tabId: 1,
        startUrl: 'http://example.com',
      };

      const response = await browser.runtime.onMessage.fire(message, {});

      expect(response).toEqual(
        expect.objectContaining({
          success: false,
          message: `Task execution failed: ${errorMessage}`,
        })
      );
    });
  });

  describe('action handler', () => {
    it('should open side panel on chrome', async () => {
      const tab = { id: 1, windowId: 1 };
      await browser.action.onClicked.fire(tab);
      expect(browser.sidePanel.open).toHaveBeenCalledWith({ tabId: 1, windowId: 1 });
    });

    it('should not try to open side panel when tab id is missing', async () => {
      const tab = { windowId: 1 };
      await browser.action.onClicked.fire(tab);
      expect(browser.sidePanel.open).not.toHaveBeenCalled();
    });
  });
});
