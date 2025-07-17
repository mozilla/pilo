import { useState, useEffect, type ReactElement } from "react";
import browser from "webextension-polyfill";
import "./SidePanel.css";
import ChatView from "./ChatView";
import SettingsView from "./SettingsView";
import { useSettings } from "../../stores/settingsStore";
import { useConversationStore } from "../../stores/conversationStore";

type View = "chat" | "settings";

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
      if (changeInfo.status === "complete" && tab.active) {
        setCurrentTab(tab);
      }
    };

    const handleTabActivated = (activeInfo: browser.Tabs.OnActivatedActiveInfoType) => {
      browser.tabs
        .get(activeInfo.tabId)
        .then((tab) => {
          setCurrentTab(tab);
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
  useEffect(() => {
    if (settingsLoaded && !settings.apiKey) {
      setCurrentView("settings");
    }
  }, [settingsLoaded, settings.apiKey]);

  const loadCurrentTab = async () => {
    try {
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (activeTab) {
        setCurrentTab(activeTab);
      }
    } catch (error) {
      console.error("Failed to load current tab:", error);
    }
  };

  const handleOpenSettings = () => {
    setCurrentView("settings");
  };

  const handleBackToChat = () => {
    setCurrentView("chat");
  };

  // Don't render anything until settings are loaded to prevent render loops
  if (!settingsLoaded) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="text-2xl">⚡</span>
          <p className="text-sm text-gray-500 mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  // Simple routing
  switch (currentView) {
    case "settings":
      return <SettingsView onBack={handleBackToChat} />;
    case "chat":
    default:
      return <ChatView currentTab={currentTab} onOpenSettings={handleOpenSettings} />;
  }
}
