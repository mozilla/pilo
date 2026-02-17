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
 */

import type { Box } from "./types.js";

export function parentElementOrShadowHost(element: Element): Element | undefined {
  if (element.parentElement) return element.parentElement;
  if (!element.parentNode) return;
  if (
    element.parentNode.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */ &&
    (element.parentNode as ShadowRoot).host
  )
    return (element.parentNode as ShadowRoot).host;
}

export function enclosingShadowRootOrDocument(element: Element): Document | ShadowRoot | undefined {
  let node: Node = element;
  while (node.parentNode) node = node.parentNode;
  if (
    node.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */ ||
    node.nodeType === 9 /* Node.DOCUMENT_NODE */
  )
    return node as Document | ShadowRoot;
}

function enclosingShadowHost(element: Element): Element | undefined {
  while (element.parentElement) element = element.parentElement;
  return parentElementOrShadowHost(element);
}

// Assumption: if scope is provided, element must be inside scope's subtree.
export function closestCrossShadow(
  element: Element | undefined,
  css: string,
  scope?: Document | Element,
): Element | undefined {
  while (element) {
    const closest = element.closest(css);
    if (scope && closest !== scope && closest?.contains(scope)) return;
    if (closest) return closest;
    element = enclosingShadowHost(element);
  }
}

export function getElementComputedStyle(
  element: Element,
  pseudo?: string,
): CSSStyleDeclaration | undefined {
  return element.ownerDocument && element.ownerDocument.defaultView
    ? element.ownerDocument.defaultView.getComputedStyle(element, pseudo)
    : undefined;
}

export function isElementStyleVisibilityVisible(
  element: Element,
  style?: CSSStyleDeclaration,
): boolean {
  style = style ?? getElementComputedStyle(element);
  if (!style) return true;
  // @ts-ignore
  if (Element.prototype.checkVisibility) {
    if (!element.checkVisibility()) return false;
  } else {
    const detailsOrSummary = element.closest("details,summary");
    if (
      detailsOrSummary !== element &&
      detailsOrSummary?.nodeName === "DETAILS" &&
      !(detailsOrSummary as HTMLDetailsElement).open
    )
      return false;
  }
  if (style.visibility !== "visible") return false;
  return true;
}

export function box(element: Element): Box {
  const style = getElementComputedStyle(element);
  if (!style) return { visible: true };
  if (style.display === "contents") {
    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1 /* Node.ELEMENT_NODE */ && isElementVisible(child as Element))
        return { visible: true, style };
      if (child.nodeType === 3 /* Node.TEXT_NODE */ && isVisibleTextNode(child as Text))
        return { visible: true, style };
    }
    return { visible: false, style };
  }
  if (!isElementStyleVisibilityVisible(element, style)) return { style, visible: false };
  const rect = element.getBoundingClientRect();
  return { rect, style, visible: rect.width > 0 && rect.height > 0 };
}

export function isElementVisible(element: Element): boolean {
  return box(element).visible;
}

export function isVisibleTextNode(node: Text) {
  const range = node.ownerDocument.createRange();
  range.selectNode(node);
  const rect = range.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function elementSafeTagName(element: Element) {
  if (element instanceof HTMLFormElement) return "FORM";
  return element.tagName.toUpperCase();
}
