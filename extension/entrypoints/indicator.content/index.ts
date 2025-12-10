// CSS-only content script for the visual indicator
// The CSS is hidden by default and toggled via class from background script
import "./styles.css";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  registration: "manifest",
  main() {
    // CSS is loaded automatically via import above
    // No JavaScript logic needed - the indicator is toggled via class from background script
  },
});
