/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * ---
 * Adapted for Pilo: stripped to AI-mode only, unified sequential refs (E1, E2, ...),
 * sets data-pilo-ref attribute during tree generation, walks same-origin iframes inline.
 */

import { normalizeWhiteSpace } from "./stringUtils.js";
import { box, getElementComputedStyle, isElementVisible } from "./domUtils.js";
import * as roleUtils from "./roleUtils.js";
import { yamlEscapeKeyIfNeeded, yamlEscapeValueIfNeeded } from "./yamlUtils.js";
import type { AriaNode, RefCounter } from "./types.js";

/**
 * Generate an ARIA tree from a root element and render it as YAML.
 *
 * Uses a global sequential counter (E1, E2, ...) for refs across the entire page.
 * Sets `data-pilo-ref` attributes on DOM elements during generation for fast lookup.
 *
 * @param root - The root element to start from (typically document.body)
 * @param counter - Mutable counter for sequential ref numbering across frames.
 *                  If not provided, starts at 0.
 * @returns The YAML string of the accessibility tree
 */
export function generateAndRenderAriaTree(root: Element, counter?: RefCounter): string {
  const refCounter = counter || { value: 0 };

  // Clean up any existing data-pilo-ref attributes from a previous snapshot
  root.querySelectorAll("[data-pilo-ref]").forEach((el) => {
    el.removeAttribute("data-pilo-ref");
    el.removeAttribute("data-pilo-role");
  });

  const ariaTree = generateAriaTree(root);
  return renderAriaTree(ariaTree, refCounter);
}

const MAX_IFRAME_DEPTH = 5;

function generateAriaTree(rootElement: Element, iframeDepth = 0): AriaNode {
  const visited = new Set<Node>();

  const root: AriaNode = {
    role: "fragment",
    name: "",
    children: [],
    element: rootElement,
    props: {},
    box: box(rootElement),
    receivesPointerEvents: true,
  };

  const visit = (ariaNode: AriaNode, node: Node) => {
    if (visited.has(node)) return;
    visited.add(node);

    if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
      const text = node.nodeValue;
      if (ariaNode.role !== "textbox" && text) ariaNode.children.push(node.nodeValue || "");
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    let isVisible = !roleUtils.isElementHiddenForAria(element);
    isVisible = isVisible || isElementVisible(element);
    if (!isVisible) return;

    const ariaChildren: Element[] = [];
    if (element.hasAttribute("aria-owns")) {
      const ids = element.getAttribute("aria-owns")!.split(/\s+/);
      for (const id of ids) {
        const ownedElement = rootElement.ownerDocument.getElementById(id);
        if (ownedElement) ariaChildren.push(ownedElement);
      }
    }

    // Handle iframes: walk into same-origin iframe contentDocument inline
    if (element.nodeName === "IFRAME") {
      if (iframeDepth >= MAX_IFRAME_DEPTH) return;
      const iframe = element as HTMLIFrameElement;
      try {
        const iframeDoc = iframe.contentDocument;
        if (iframeDoc && iframeDoc.body) {
          // Same-origin iframe: walk into it inline
          iframeDoc.body
            .querySelectorAll("[data-pilo-ref]")
            .forEach((el) => el.removeAttribute("data-pilo-ref"));
          const iframeTree = generateAriaTree(iframeDoc.body, iframeDepth + 1);
          // Merge iframe children into current node
          for (const child of iframeTree.children) {
            ariaNode.children.push(child);
          }
          return;
        }
      } catch {
        // Cross-origin iframe: create a placeholder node
      }
      const iframeNode: AriaNode = {
        role: "iframe",
        name: "",
        children: [],
        props: {},
        element,
        box: box(element),
        receivesPointerEvents: true,
      };
      ariaNode.children.push(iframeNode);
      return;
    }

    const childAriaNode = toAriaNode(element);
    if (childAriaNode) {
      ariaNode.children.push(childAriaNode);
    }
    processElement(childAriaNode || ariaNode, element, ariaChildren);
  };

  function processElement(ariaNode: AriaNode, element: Element, ariaChildren: Element[] = []) {
    const display = getElementComputedStyle(element)?.display || "inline";
    const treatAsBlock = display !== "inline" || element.nodeName === "BR" ? " " : "";
    if (treatAsBlock) ariaNode.children.push(treatAsBlock);

    ariaNode.children.push(roleUtils.getCSSContent(element, "::before") || "");
    const assignedNodes =
      element.nodeName === "SLOT" ? (element as HTMLSlotElement).assignedNodes() : [];
    if (assignedNodes.length) {
      for (const child of assignedNodes) visit(ariaNode, child);
    } else {
      for (let child = element.firstChild; child; child = child.nextSibling) {
        if (!(child as Element | Text).assignedSlot) visit(ariaNode, child);
      }
      if (element.shadowRoot) {
        for (let child = element.shadowRoot.firstChild; child; child = child.nextSibling)
          visit(ariaNode, child);
      }
    }

    for (const child of ariaChildren) visit(ariaNode, child);

    ariaNode.children.push(roleUtils.getCSSContent(element, "::after") || "");

    if (treatAsBlock) ariaNode.children.push(treatAsBlock);

    if (ariaNode.children.length === 1 && ariaNode.name === ariaNode.children[0])
      ariaNode.children = [];

    if (ariaNode.role === "link" && element.hasAttribute("href")) {
      const href = element.getAttribute("href")!;
      ariaNode.props["url"] = href;
    }
  }

  roleUtils.beginAriaCaches();
  try {
    visit(root, rootElement);
  } finally {
    roleUtils.endAriaCaches();
  }

  normalizeStringChildren(root);
  normalizeGenericRoles(root);
  return root;
}

function toAriaNode(element: Element): AriaNode | null {
  const role = roleUtils.getAriaRole(element) ?? "generic";
  if (role === "presentation" || role === "none") return null;

  const name = normalizeWhiteSpace(roleUtils.getElementAccessibleName(element, false) || "");
  const pointerEvents = roleUtils.receivesPointerEvents(element);

  const result: AriaNode = {
    role,
    name,
    children: [],
    props: {},
    element,
    box: box(element),
    receivesPointerEvents: pointerEvents,
  };

  if (roleUtils.kAriaCheckedRoles.includes(role))
    result.checked = roleUtils.getAriaChecked(element);

  if (roleUtils.kAriaDisabledRoles.includes(role))
    result.disabled = roleUtils.getAriaDisabled(element);

  if (roleUtils.kAriaExpandedRoles.includes(role))
    result.expanded = roleUtils.getAriaExpanded(element);

  if (roleUtils.kAriaLevelRoles.includes(role)) result.level = roleUtils.getAriaLevel(element);

  if (roleUtils.kAriaPressedRoles.includes(role))
    result.pressed = roleUtils.getAriaPressed(element);

  if (roleUtils.kAriaSelectedRoles.includes(role))
    result.selected = roleUtils.getAriaSelected(element);

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    // Types whose .value shouldn't be exposed as text children:
    // password: sensitive credential; checkbox/radio: state shown via [checked]; file: just filename
    const nonTextTypes = ["password", "checkbox", "radio", "file"];
    const sensitiveAutocomplete = [
      "cc-number",
      "cc-name",
      "cc-csc",
      "cc-exp",
      "cc-exp-month",
      "cc-exp-year",
      "cc-type",
      "new-password",
      "current-password",
      "one-time-code",
    ];
    const autocomplete = element.getAttribute("autocomplete") || "";
    if (!nonTextTypes.includes(element.type) && !sensitiveAutocomplete.includes(autocomplete)) {
      result.children = [element.value];
    }
  }

  return result;
}

function normalizeGenericRoles(node: AriaNode) {
  const normalizeChildren = (node: AriaNode) => {
    const result: (AriaNode | string)[] = [];
    for (const child of node.children || []) {
      if (typeof child === "string") {
        result.push(child);
        continue;
      }
      const normalized = normalizeChildren(child);
      result.push(...normalized);
    }

    const removeSelf =
      node.role === "generic" &&
      result.length <= 1 &&
      result.every((c) => typeof c !== "string" && nodeReceivesPointerEvents(c));
    if (removeSelf) return result;
    node.children = result;
    return [node];
  };

  normalizeChildren(node);
}

function normalizeStringChildren(rootA11yNode: AriaNode) {
  const flushChildren = (buffer: string[], normalizedChildren: (AriaNode | string)[]) => {
    if (!buffer.length) return;
    const text = normalizeWhiteSpace(buffer.join(""));
    if (text) normalizedChildren.push(text);
    buffer.length = 0;
  };

  const visit = (ariaNode: AriaNode) => {
    const normalizedChildren: (AriaNode | string)[] = [];
    const buffer: string[] = [];
    for (const child of ariaNode.children || []) {
      if (typeof child === "string") {
        buffer.push(child);
      } else {
        flushChildren(buffer, normalizedChildren);
        visit(child);
        normalizedChildren.push(child);
      }
    }
    flushChildren(buffer, normalizedChildren);
    ariaNode.children = normalizedChildren.length ? normalizedChildren : [];
    if (ariaNode.children.length === 1 && ariaNode.children[0] === ariaNode.name)
      ariaNode.children = [];
  };
  visit(rootA11yNode);
}

// === Set-of-Marks (SoM) overlay ===

const SOM_CONTAINER_ID = "__pilo-som-container";

const SOM_COLORS = [
  "#e6194b", // red
  "#3cb44b", // green
  "#4363d8", // blue
  "#f58231", // orange
  "#911eb4", // purple
  "#42d4f4", // cyan
];

// Interactive HTML tags and ARIA roles that are meaningful click/input targets.
// Structural containers (generic, list, navigation, main, etc.) are excluded
// to reduce visual noise — they have refs in the YAML but aren't useful to click.
const SOM_INTERACTIVE_TAGS = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"]);
const SOM_INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "combobox",
  "checkbox",
  "radio",
  "switch",
  "slider",
  "spinbutton",
  "searchbox",
  "option",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "treeitem",
  "gridcell",
  "columnheader",
  "rowheader",
]);

export function isInteractiveElement(el: Element): boolean {
  if (SOM_INTERACTIVE_TAGS.has(el.tagName)) return true;

  // Check contenteditable (rich text editors)
  const ce = el.getAttribute("contenteditable");
  if (ce === "true" || ce === "") return true;

  // Use computed role (set during renderAriaTree) for accurate role detection,
  // falling back to the raw role attribute which may contain space-separated fallback values
  const computedRole = el.getAttribute("data-pilo-role");
  if (computedRole && SOM_INTERACTIVE_ROLES.has(computedRole)) return true;
  const rawRole = el.getAttribute("role");
  if (rawRole) {
    const roles = rawRole.split(/\s+/);
    if (roles.some((r) => SOM_INTERACTIVE_ROLES.has(r))) return true;
  }

  // Elements made focusable via tabindex with no semantic role are likely JS-driven widgets
  const tabindex = el.getAttribute("tabindex");
  if (tabindex !== null) {
    const tabValue = parseInt(tabindex, 10);
    if (!isNaN(tabValue) && tabValue >= 0 && (!computedRole || computedRole === "generic")) {
      return true;
    }
  }

  return false;
}

/**
 * Overlay labeled badges on interactive elements that have `data-pilo-ref` attributes.
 * Each badge shows the ref ID (e.g., "E1") positioned at the element's top-left corner
 * with a colored outline. Only interactive elements get marks — structural containers
 * are skipped to reduce visual noise.
 *
 * Call removeSetOfMarks() to clean up (also called automatically at the start).
 */
export function applySetOfMarks(): void {
  removeSetOfMarks();
  if (!document.body) return;

  const container = document.createElement("div");
  container.id = SOM_CONTAINER_ID;
  container.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647;";

  const elements = document.querySelectorAll("[data-pilo-ref]");
  let colorIndex = 0;

  elements.forEach((el) => {
    const ref = el.getAttribute("data-pilo-ref");
    if (!ref) return;

    // Skip non-interactive structural containers
    if (!isInteractiveElement(el)) return;

    const rect = el.getBoundingClientRect();
    // Skip invisible elements (0x0 bounding rect)
    if (rect.width === 0 && rect.height === 0) return;

    const color = SOM_COLORS[colorIndex % SOM_COLORS.length];

    const absTop = rect.top + window.scrollY;
    const absLeft = rect.left + window.scrollX;

    // Highlight outline
    const outline = document.createElement("div");
    outline.style.cssText = `position:absolute;top:${absTop}px;left:${absLeft}px;width:${rect.width}px;height:${rect.height}px;border:2px solid ${color};box-sizing:border-box;border-radius:2px;`;
    container.appendChild(outline);

    // Badge label
    const badge = document.createElement("div");
    badge.textContent = ref;
    badge.style.cssText = `position:absolute;top:${absTop}px;left:${absLeft}px;background:${color};color:#fff;font:bold 11px monospace;padding:1px 3px;border-radius:2px;line-height:1.2;white-space:nowrap;`;
    container.appendChild(badge);

    colorIndex++;
  });

  document.body.appendChild(container);
}

/**
 * Remove the SoM overlay container. Safe to call when no marks exist.
 */
export function removeSetOfMarks(): void {
  const existing = document.getElementById(SOM_CONTAINER_ID);
  if (existing) existing.remove();
}

// === Rendering helpers ===

function nodeReceivesPointerEvents(ariaNode: AriaNode): boolean {
  return ariaNode.box.visible && ariaNode.receivesPointerEvents;
}

function hasPointerCursor(ariaNode: AriaNode): boolean {
  return ariaNode.box.style?.cursor === "pointer";
}

function renderAriaTree(root: AriaNode, counter: RefCounter): string {
  const lines: string[] = [];

  const visit = (ariaNode: AriaNode | string, _parentAriaNode: AriaNode | null, indent: string) => {
    if (typeof ariaNode === "string") {
      const text = yamlEscapeValueIfNeeded(ariaNode);
      if (text) lines.push(indent + "- text: " + text);
      return;
    }

    let key = ariaNode.role;
    if (ariaNode.name) {
      const displayName =
        ariaNode.name.length > 900 ? ariaNode.name.slice(0, 900) + "..." : ariaNode.name;
      const stringifiedName = JSON.stringify(displayName);
      key += " " + stringifiedName;
    }
    if (ariaNode.checked === "mixed") key += ` [checked=mixed]`;
    if (ariaNode.checked === true) key += ` [checked]`;
    if (ariaNode.disabled) key += ` [disabled]`;
    if (ariaNode.expanded) key += ` [expanded]`;
    if (ariaNode.level) key += ` [level=${ariaNode.level}]`;
    if (ariaNode.pressed === "mixed") key += ` [pressed=mixed]`;
    if (ariaNode.pressed === true) key += ` [pressed]`;
    if (ariaNode.selected === true) key += ` [selected]`;

    // Assign ref only for visible, interactable elements.
    // SECURITY: Refs are counter-generated ("E1", "E2", ...) — never from external input,
    // since they're used in CSS attribute selectors for element lookup.
    if (nodeReceivesPointerEvents(ariaNode)) {
      const ref = "E" + ++counter.value;
      const cursor = hasPointerCursor(ariaNode) ? " [cursor=pointer]" : "";
      key += ` [ref=${ref}]${cursor}`;
      ariaNode.element?.setAttribute("data-pilo-ref", ref);
      // Store computed role for accurate SoM filtering (avoids re-computing or parsing raw role attribute)
      ariaNode.element?.setAttribute("data-pilo-role", ariaNode.role);
    }

    const escapedKey = indent + "- " + yamlEscapeKeyIfNeeded(key);
    const hasProps = !!Object.keys(ariaNode.props).length;
    if (!ariaNode.children.length && !hasProps) {
      lines.push(escapedKey);
    } else if (
      ariaNode.children.length === 1 &&
      typeof ariaNode.children[0] === "string" &&
      !hasProps
    ) {
      const text = ariaNode.children[0] as string;
      if (text) lines.push(escapedKey + ": " + yamlEscapeValueIfNeeded(text));
      else lines.push(escapedKey);
    } else {
      lines.push(escapedKey + ":");
      for (const [name, value] of Object.entries(ariaNode.props))
        lines.push(indent + "  - /" + name + ": " + yamlEscapeValueIfNeeded(value));
      for (const child of ariaNode.children || []) visit(child, ariaNode, indent + "  ");
    }
  };

  if (root.role === "fragment") {
    for (const child of root.children || []) visit(child, root, "");
  } else {
    visit(root, null, "");
  }
  return lines.join("\n");
}
