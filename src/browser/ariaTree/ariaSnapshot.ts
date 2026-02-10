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
 * Adapted for Spark: stripped to AI-mode only, unified sequential refs (E1, E2, ...),
 * sets aria-ref attribute during tree generation, walks same-origin iframes inline.
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
 * Sets `aria-ref` attributes on DOM elements during generation for fast lookup.
 *
 * @param root - The root element to start from (typically document.body)
 * @param counter - Mutable counter for sequential ref numbering across frames.
 *                  If not provided, starts at 0.
 * @returns The YAML string of the accessibility tree
 */
export function generateAndRenderAriaTree(root: Element, counter?: RefCounter): string {
  const refCounter = counter || { value: 0 };

  // Clean up any existing aria-ref attributes from a previous snapshot
  root.querySelectorAll("[aria-ref]").forEach((el) => el.removeAttribute("aria-ref"));

  const ariaTree = generateAriaTree(root, refCounter);
  return renderAriaTree(ariaTree);
}

const MAX_IFRAME_DEPTH = 5;

function generateAriaTree(rootElement: Element, counter: RefCounter, iframeDepth = 0): AriaNode {
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
          // Same-origin iframe: walk into it with the same counter
          iframeDoc.body
            .querySelectorAll("[aria-ref]")
            .forEach((el) => el.removeAttribute("aria-ref"));
          const iframeTree = generateAriaTree(iframeDoc.body, counter, iframeDepth + 1);
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

    const childAriaNode = toAriaNode(element, counter);
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

function toAriaNode(element: Element, counter: RefCounter): AriaNode | null {
  const role = roleUtils.getAriaRole(element) ?? "generic";
  if (role === "presentation" || role === "none") return null;

  const name = normalizeWhiteSpace(roleUtils.getElementAccessibleName(element, false) || "");
  const pointerEvents = roleUtils.receivesPointerEvents(element);

  const ref = "E" + ++counter.value;
  // Set aria-ref attribute on the element for fast CSS selector lookup
  element.setAttribute("aria-ref", ref);

  const result: AriaNode = {
    role,
    name,
    ref,
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

function nodeReceivesPointerEvents(ariaNode: AriaNode): boolean {
  return ariaNode.box.visible && ariaNode.receivesPointerEvents;
}

function hasPointerCursor(ariaNode: AriaNode): boolean {
  return ariaNode.box.style?.cursor === "pointer";
}

function renderAriaTree(root: AriaNode): string {
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

    // Emit ref and cursor info for interactable elements
    if (nodeReceivesPointerEvents(ariaNode)) {
      const ref = ariaNode.ref;
      const cursor = hasPointerCursor(ariaNode) ? " [cursor=pointer]" : "";
      if (ref) key += ` [ref=${ref}]${cursor}`;
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
