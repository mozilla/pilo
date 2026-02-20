import { useState, useEffect, type ReactElement } from "react";
import browser from "webextension-polyfill";
import "./SidePanel.css";
import ChatView from "./ChatView";
import SettingsView from "./SettingsView";
import { SidebarHeader } from "./SidebarHeader";
import { ThemeProvider } from "../ThemeProvider";
import { useSettings } from "../../stores/settingsStore";
import { useConversationStore } from "../../../shared/conversationStore";

type View = "chat" | "settings";

// Helper to check if a URL is a valid web page (not a special Chrome page)
const isWebPageUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
};

export default function SidePanel(): ReactElement {
  const [currentView, setCurrentView] = useState<View>("chat");
  const [currentTab, setCurrentTab] = useState<browser.Tabs.Tab | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const { settings, loadSettings } = useSettings();

  // Load settings and current tab on component mount
  useEffect(() => {
    const load = async () => {
      await loadSettings();
      setSettingsLoaded(true);
    };
    load();
    loadCurrentTab();
  }, [loadSettings]);

  // Monitor tab changes and handle tab removal
  useEffect(() => {
    const handleTabUpdated = (
      _tabId: number,
      changeInfo: browser.Tabs.OnUpdatedChangeInfoType,
      tab: browser.Tabs.Tab,
    ) => {
      // Only update for valid web pages (not extension or chrome:// pages)
      if (changeInfo.status === "complete" && tab.active && isWebPageUrl(tab.url)) {
        setCurrentTab(tab);
      }
    };

    const handleTabActivated = (activeInfo: browser.Tabs.OnActivatedActiveInfoType) => {
      browser.tabs
        .get(activeInfo.tabId)
        .then((tab) => {
          // Only update for valid web pages (not extension or chrome:// pages)
          if (isWebPageUrl(tab.url)) {
            setCurrentTab(tab);
          }
        })
        .catch(console.error);
    };

    const handleTabRemoved = (tabId: number) => {
      // Clean up conversation for this tab
      useConversationStore.getState().deleteConversation(tabId);
    };

    browser.tabs.onUpdated.addListener(handleTabUpdated);
    browser.tabs.onActivated.addListener(handleTabActivated);
    browser.tabs.onRemoved.addListener(handleTabRemoved);

    return () => {
      browser.tabs.onUpdated.removeListener(handleTabUpdated);
      browser.tabs.onActivated.removeListener(handleTabActivated);
      browser.tabs.onRemoved.removeListener(handleTabRemoved);
    };
  }, []);

  // Show settings automatically if no API key is configured (only after settings load)
  // API key is optional for Ollama
  useEffect(() => {
    if (settingsLoaded && !settings.apiKey && settings.provider !== "ollama") {
      setCurrentView("settings");
    }
  }, [settingsLoaded, settings.apiKey, settings.provider]);

  const loadCurrentTab = async () => {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      // Filter out extension pages and Chrome internal pages, find the first real web page
      const activeTab = tabs.find((tab) => isWebPageUrl(tab.url));
      if (activeTab) {
        setCurrentTab(activeTab);
      } else if (tabs.length > 0) {
        // Fall back to first tab if no web page tab found
        setCurrentTab(tabs[0]);
      }
    } catch (error) {
      console.error("Failed to load current tab:", error);
    }
  };

  const handleNavigate = (view: View) => {
    setCurrentView(view);
  };

  // Clear chat is dispatched to ChatView via a custom DOM event so the header
  // can trigger it without prop-drilling through the view switcher.
  const handleClearChat = () => {
    document.documentElement.dispatchEvent(new CustomEvent("pilo:clear-chat"));
  };

  // Don't render anything until settings are loaded to prevent render loops
  if (!settingsLoaded) {
    return (
      <ThemeProvider>
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <span className="text-2xl">⚡</span>
            <p className="text-sm text-muted-foreground mt-2">Loading...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="h-screen flex flex-col bg-background text-foreground">
        <SidebarHeader
          view={currentView}
          onNavigate={handleNavigate}
          onClearChat={handleClearChat}
        />

        {/* Route between views */}
        {currentView === "settings" ? (
          <div className="flex-1 overflow-hidden">
            <SettingsView onBack={() => handleNavigate("chat")} />
          </div>
        ) : (
          <ChatView currentTab={currentTab} onOpenSettings={() => handleNavigate("settings")} />
        )}
      </div>
    </ThemeProvider>
  );
}
