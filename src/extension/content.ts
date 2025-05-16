// Import ariaSnapshot functionality
import { generateAriaTree, renderAriaTree } from '../vendor/ariaSnapshot.js';

// Make functions available globally for executeScript
declare global {
    interface Window {
        generateAriaTree: typeof generateAriaTree;
        renderAriaTree: typeof renderAriaTree;
    }
}

window.generateAriaTree = generateAriaTree;
window.renderAriaTree = renderAriaTree;

console.log("Spark content script running on this page.");
