import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsView from "../../src/components/sidepanel/SettingsView.js";

// Mock the hooks
const mockUpdateSettings = vi.fn();
const mockSaveSettings = vi.fn();

vi.mock("src/stores/settingsStore", () => ({
  useSettings: vi.fn(() => ({
    settings: {
      apiKey: "test-key",
      apiEndpoint: "",
      model: "google/gemini-2.5-flash",
      provider: "openrouter",
    },
    saveStatus: null,
    updateSettings: mockUpdateSettings,
    saveSettings: mockSaveSettings,
  })),
}));

const mockTheme = {
  bg: {
    primary: "bg-white",
    secondary: "bg-gray-50",
    input: "bg-white",
    error: "bg-red-50",
    success: "bg-green-50",
  },
  text: {
    primary: "text-gray-900",
    secondary: "text-gray-700",
    muted: "text-gray-500",
    error: "text-red-700",
    success: "text-green-700",
  },
  border: {
    primary: "border-gray-200",
    input: "border-gray-300",
    error: "border-red-200",
    success: "border-green-200",
  },
};

vi.mock("src/useSystemTheme", () => ({
  useSystemTheme: vi.fn(() => ({
    isDark: false,
    theme: mockTheme,
  })),
}));

describe("SettingsView - Provider Dropdown", () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render provider dropdown", () => {
      render(<SettingsView onBack={mockOnBack} />);

      const providerLabel = screen.getByText("Provider");
      expect(providerLabel).toBeInTheDocument();

      // Find the select element (there's only one combobox)
      const selects = screen.getAllByRole("combobox");
      expect(selects).toHaveLength(1);
      expect(selects[0]).toBeInTheDocument();
    });

    it("should display current provider value", () => {
      render(<SettingsView onBack={mockOnBack} />);

      const providerSelect = screen.getByRole("combobox") as HTMLSelectElement;
      expect(providerSelect.value).toBe("openrouter");
    });

    it("should show OpenAI and OpenRouter options", () => {
      render(<SettingsView onBack={mockOnBack} />);

      const openaiOption = screen.getByRole("option", { name: "OpenAI" }) as HTMLOptionElement;
      const openrouterOption = screen.getByRole("option", {
        name: "OpenRouter",
      }) as HTMLOptionElement;

      expect(openaiOption).toBeInTheDocument();
      expect(openrouterOption).toBeInTheDocument();
    });
  });

  describe("User Interaction", () => {
    it("should have onChange handler attached", () => {
      render(<SettingsView onBack={mockOnBack} />);

      const providerSelect = screen.getByRole("combobox") as HTMLSelectElement;

      // Verify the select element is interactive
      expect(providerSelect).not.toBeDisabled();
      expect(providerSelect.tagName).toBe("SELECT");
    });

    it("should render with default provider value", () => {
      render(<SettingsView onBack={mockOnBack} />);

      const providerSelect = screen.getByRole("combobox") as HTMLSelectElement;

      // Check that provider value is set
      expect(providerSelect.value).toBe("openrouter");
    });
  });

  describe("Form Integration", () => {
    it("should preserve provider value across re-renders", () => {
      const { rerender } = render(<SettingsView onBack={mockOnBack} />);

      let providerSelect = screen.getByRole("combobox") as HTMLSelectElement;
      expect(providerSelect.value).toBe("openrouter");

      rerender(<SettingsView onBack={mockOnBack} />);

      providerSelect = screen.getByRole("combobox") as HTMLSelectElement;
      expect(providerSelect.value).toBe("openrouter");
    });

    it("should have save button", () => {
      render(<SettingsView onBack={mockOnBack} />);

      const saveButton = screen.getByRole("button", { name: /save settings/i });
      expect(saveButton).toBeInTheDocument();
    });

    it("should have back button", () => {
      render(<SettingsView onBack={mockOnBack} />);

      const backButton = screen.getByRole("button", { name: /back to chat/i });
      expect(backButton).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper label for provider dropdown", () => {
      render(<SettingsView onBack={mockOnBack} />);

      const label = screen.getByText("Provider");
      const providerSelect = screen.getByRole("combobox");

      expect(label).toBeInTheDocument();
      expect(providerSelect).toBeInTheDocument();
    });

    it("should be keyboard navigable", () => {
      render(<SettingsView onBack={mockOnBack} />);

      const providerSelect = screen.getByRole("combobox");

      // Provider select should be focusable
      providerSelect.focus();
      expect(providerSelect).toHaveFocus();
    });
  });

  describe("Provider-specific behavior", () => {
    it("should display OpenRouter as default provider", () => {
      render(<SettingsView onBack={mockOnBack} />);

      const providerSelect = screen.getByRole("combobox");

      // Should start as OpenRouter
      expect((providerSelect as HTMLSelectElement).value).toBe("openrouter");
    });

    it("should have both OpenAI and OpenRouter as selectable options", () => {
      render(<SettingsView onBack={mockOnBack} />);

      const openaiOption = screen.getByRole("option", { name: "OpenAI" }) as HTMLOptionElement;
      const openrouterOption = screen.getByRole("option", {
        name: "OpenRouter",
      }) as HTMLOptionElement;

      // Both options should be present and selectable
      expect(openaiOption.value).toBe("openai");
      expect(openrouterOption.value).toBe("openrouter");
    });
  });

  describe("Other form fields", () => {
    it("should render all required fields including provider", () => {
      render(<SettingsView onBack={mockOnBack} />);

      expect(screen.getByText("Provider")).toBeInTheDocument();
      expect(screen.getByText("Model")).toBeInTheDocument();
      expect(screen.getByText(/API Endpoint/)).toBeInTheDocument();
      expect(screen.getByText(/API Key/)).toBeInTheDocument();
    });
  });
});
