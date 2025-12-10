// CSS-only content script for the visual indicator
// The CSS is hidden by default and toggled via class from background script
import "./styles.css";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  registration: "manifest",
  main() {
    // CSS is loaded automatically via import above
    // The indicator class is toggled from background script via scripting.executeScript
  },
});
