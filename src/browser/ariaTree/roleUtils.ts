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

import * as css from "./cssTokenizer.js";
import {
  closestCrossShadow,
  elementSafeTagName,
  enclosingShadowRootOrDocument,
  getElementComputedStyle,
  isElementStyleVisibilityVisible,
  isVisibleTextNode,
  parentElementOrShadowHost,
} from "./domUtils.js";
import type { AriaRole } from "./types.js";

function hasExplicitAccessibleName(e: Element) {
  return e.hasAttribute("aria-label") || e.hasAttribute("aria-labelledby");
}

const kAncestorPreventingLandmark =
  "article:not([role]), aside:not([role]), main:not([role]), nav:not([role]), section:not([role]), [role=article], [role=complementary], [role=main], [role=navigation], [role=region]";

const kGlobalAriaAttributes: [string, string[] | undefined][] = [
  ["aria-atomic", undefined],
  ["aria-busy", undefined],
  ["aria-controls", undefined],
  ["aria-current", undefined],
  ["aria-describedby", undefined],
  ["aria-details", undefined],
  ["aria-dropeffect", undefined],
  ["aria-flowto", undefined],
  ["aria-grabbed", undefined],
  ["aria-hidden", undefined],
  ["aria-keyshortcuts", undefined],
  [
    "aria-label",
    [
      "caption",
      "code",
      "deletion",
      "emphasis",
      "generic",
      "insertion",
      "paragraph",
      "presentation",
      "strong",
      "subscript",
      "superscript",
    ],
  ],
  [
    "aria-labelledby",
    [
      "caption",
      "code",
      "deletion",
      "emphasis",
      "generic",
      "insertion",
      "paragraph",
      "presentation",
      "strong",
      "subscript",
      "superscript",
    ],
  ],
  ["aria-live", undefined],
  ["aria-owns", undefined],
  ["aria-relevant", undefined],
  ["aria-roledescription", ["generic"]],
];

function hasGlobalAriaAttribute(element: Element, forRole?: string | null) {
  return kGlobalAriaAttributes.some(([attr, prohibited]) => {
    return !prohibited?.includes(forRole || "") && element.hasAttribute(attr);
  });
}

function hasTabIndex(element: Element) {
  return !Number.isNaN(Number(String(element.getAttribute("tabindex"))));
}

function isFocusable(element: Element) {
  return !isNativelyDisabled(element) && (isNativelyFocusable(element) || hasTabIndex(element));
}

function isNativelyFocusable(element: Element) {
  const tagName = elementSafeTagName(element);
  if (["BUTTON", "DETAILS", "SELECT", "TEXTAREA"].includes(tagName)) return true;
  if (tagName === "A" || tagName === "AREA") return element.hasAttribute("href");
  if (tagName === "INPUT") return !(element as HTMLInputElement).hidden;
  return false;
}

const kImplicitRoleByTagName: { [tagName: string]: (e: Element) => AriaRole | null } = {
  A: (e: Element) => (e.hasAttribute("href") ? "link" : null),
  AREA: (e: Element) => (e.hasAttribute("href") ? "link" : null),
  ARTICLE: () => "article",
  ASIDE: () => "complementary",
  BLOCKQUOTE: () => "blockquote",
  BUTTON: () => "button",
  CAPTION: () => "caption",
  CODE: () => "code",
  DATALIST: () => "listbox",
  DD: () => "definition",
  DEL: () => "deletion",
  DETAILS: () => "group",
  DFN: () => "term",
  DIALOG: () => "dialog",
  DT: () => "term",
  EM: () => "emphasis",
  FIELDSET: () => "group",
  FIGURE: () => "figure",
  FOOTER: (e: Element) =>
    closestCrossShadow(e, kAncestorPreventingLandmark) ? null : "contentinfo",
  FORM: (e: Element) => (hasExplicitAccessibleName(e) ? "form" : null),
  H1: () => "heading",
  H2: () => "heading",
  H3: () => "heading",
  H4: () => "heading",
  H5: () => "heading",
  H6: () => "heading",
  HEADER: (e: Element) => (closestCrossShadow(e, kAncestorPreventingLandmark) ? null : "banner"),
  HR: () => "separator",
  HTML: () => "document",
  IMG: (e: Element) =>
    e.getAttribute("alt") === "" &&
    !e.getAttribute("title") &&
    !hasGlobalAriaAttribute(e) &&
    !hasTabIndex(e)
      ? "presentation"
      : "img",
  INPUT: (e: Element) => {
    const type = (e as HTMLInputElement).type.toLowerCase();
    if (type === "search") return e.hasAttribute("list") ? "combobox" : "searchbox";
    if (["email", "tel", "text", "url", ""].includes(type)) {
      const list = getIdRefs(e, e.getAttribute("list"))[0];
      return list && elementSafeTagName(list) === "DATALIST" ? "combobox" : "textbox";
    }
    if (type === "hidden") return null;
    if (type === "file") return "button";
    return inputTypeToRole[type] || "textbox";
  },
  INS: () => "insertion",
  LI: () => "listitem",
  MAIN: () => "main",
  MARK: () => "mark",
  MATH: () => "math",
  MENU: () => "list",
  METER: () => "meter",
  NAV: () => "navigation",
  OL: () => "list",
  OPTGROUP: () => "group",
  OPTION: () => "option",
  OUTPUT: () => "status",
  P: () => "paragraph",
  PROGRESS: () => "progressbar",
  SECTION: (e: Element) => (hasExplicitAccessibleName(e) ? "region" : null),
  SELECT: (e: Element) =>
    e.hasAttribute("multiple") || (e as HTMLSelectElement).size > 1 ? "listbox" : "combobox",
  STRONG: () => "strong",
  SUB: () => "subscript",
  SUP: () => "superscript",
  SVG: () => "img",
  TABLE: () => "table",
  TBODY: () => "rowgroup",
  TD: (e: Element) => {
    const table = closestCrossShadow(e, "table");
    const role = table ? getExplicitAriaRole(table) : "";
    return role === "grid" || role === "treegrid" ? "gridcell" : "cell";
  },
  TEXTAREA: () => "textbox",
  TFOOT: () => "rowgroup",
  TH: (e: Element) => {
    if (e.getAttribute("scope") === "col") return "columnheader";
    if (e.getAttribute("scope") === "row") return "rowheader";
    const table = closestCrossShadow(e, "table");
    const role = table ? getExplicitAriaRole(table) : "";
    return role === "grid" || role === "treegrid" ? "gridcell" : "cell";
  },
  THEAD: () => "rowgroup",
  TIME: () => "time",
  TR: () => "row",
  UL: () => "list",
};

const kPresentationInheritanceParents: { [tagName: string]: string[] } = {
  DD: ["DL", "DIV"],
  DIV: ["DL"],
  DT: ["DL", "DIV"],
  LI: ["OL", "UL"],
  TBODY: ["TABLE"],
  TD: ["TR"],
  TFOOT: ["TABLE"],
  TH: ["TR"],
  THEAD: ["TABLE"],
  TR: ["THEAD", "TBODY", "TFOOT", "TABLE"],
};

function getImplicitAriaRole(element: Element): AriaRole | null {
  const implicitRole = kImplicitRoleByTagName[elementSafeTagName(element)]?.(element) || "";
  if (!implicitRole) return null;
  let ancestor: Element | null = element;
  while (ancestor) {
    const parent = parentElementOrShadowHost(ancestor);
    const parents = kPresentationInheritanceParents[elementSafeTagName(ancestor)];
    if (!parents || !parent || !parents.includes(elementSafeTagName(parent))) break;
    const parentExplicitRole = getExplicitAriaRole(parent);
    if (
      (parentExplicitRole === "none" || parentExplicitRole === "presentation") &&
      !hasPresentationConflictResolution(parent, parentExplicitRole)
    )
      return parentExplicitRole;
    ancestor = parent;
  }
  return implicitRole;
}

const validRoles: AriaRole[] = [
  "alert",
  "alertdialog",
  "application",
  "article",
  "banner",
  "blockquote",
  "button",
  "caption",
  "cell",
  "checkbox",
  "code",
  "columnheader",
  "combobox",
  "complementary",
  "contentinfo",
  "definition",
  "deletion",
  "dialog",
  "directory",
  "document",
  "emphasis",
  "feed",
  "figure",
  "form",
  "generic",
  "grid",
  "gridcell",
  "group",
  "heading",
  "img",
  "insertion",
  "link",
  "list",
  "listbox",
  "listitem",
  "log",
  "main",
  "mark",
  "marquee",
  "math",
  "meter",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "navigation",
  "none",
  "note",
  "option",
  "paragraph",
  "presentation",
  "progressbar",
  "radio",
  "radiogroup",
  "region",
  "row",
  "rowgroup",
  "rowheader",
  "scrollbar",
  "search",
  "searchbox",
  "separator",
  "slider",
  "spinbutton",
  "status",
  "strong",
  "subscript",
  "superscript",
  "switch",
  "tab",
  "table",
  "tablist",
  "tabpanel",
  "term",
  "textbox",
  "time",
  "timer",
  "toolbar",
  "tooltip",
  "tree",
  "treegrid",
  "treeitem",
];

function getExplicitAriaRole(element: Element): AriaRole | null {
  const roles = (element.getAttribute("role") || "").split(" ").map((role) => role.trim());
  return (roles.find((role) => validRoles.includes(role as any)) as AriaRole) || null;
}

function hasPresentationConflictResolution(element: Element, role: string | null) {
  return hasGlobalAriaAttribute(element, role) || isFocusable(element);
}

export function getAriaRole(element: Element): AriaRole | null {
  const explicitRole = getExplicitAriaRole(element);
  if (!explicitRole) return getImplicitAriaRole(element);
  if (explicitRole === "none" || explicitRole === "presentation") {
    const implicitRole = getImplicitAriaRole(element);
    if (hasPresentationConflictResolution(element, implicitRole)) return implicitRole;
  }
  return explicitRole;
}

function getAriaBoolean(attr: string | null) {
  return attr === null ? undefined : attr.toLowerCase() === "true";
}

export function isElementIgnoredForAria(element: Element) {
  return ["STYLE", "SCRIPT", "NOSCRIPT", "TEMPLATE"].includes(elementSafeTagName(element));
}

export function isElementHiddenForAria(element: Element): boolean {
  if (isElementIgnoredForAria(element)) return true;
  const style = getElementComputedStyle(element);
  const isSlot = element.nodeName === "SLOT";
  if (style?.display === "contents" && !isSlot) {
    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1 /* Node.ELEMENT_NODE */ && !isElementHiddenForAria(child as Element))
        return false;
      if (child.nodeType === 3 /* Node.TEXT_NODE */ && isVisibleTextNode(child as Text))
        return false;
    }
    return true;
  }
  const isOptionInsideSelect = element.nodeName === "OPTION" && !!element.closest("select");
  if (!isOptionInsideSelect && !isSlot && !isElementStyleVisibilityVisible(element, style))
    return true;
  return belongsToDisplayNoneOrAriaHiddenOrNonSlotted(element);
}

function belongsToDisplayNoneOrAriaHiddenOrNonSlotted(element: Element): boolean {
  let hidden = cacheIsHidden?.get(element);
  if (hidden === undefined) {
    hidden = false;

    if (element.parentElement && element.parentElement.shadowRoot && !element.assignedSlot)
      hidden = true;

    if (!hidden) {
      const style = getElementComputedStyle(element);
      hidden =
        !style ||
        style.display === "none" ||
        getAriaBoolean(element.getAttribute("aria-hidden")) === true;
    }

    if (!hidden) {
      const parent = parentElementOrShadowHost(element);
      if (parent) hidden = belongsToDisplayNoneOrAriaHiddenOrNonSlotted(parent);
    }
    cacheIsHidden?.set(element, hidden);
  }
  return hidden;
}

function getIdRefs(element: Element, ref: string | null): Element[] {
  if (!ref) return [];
  const root = enclosingShadowRootOrDocument(element);
  if (!root) return [];
  try {
    const ids = ref.split(" ").filter((id) => !!id);
    const result: Element[] = [];
    for (const id of ids) {
      const firstElement = root.querySelector("#" + CSS.escape(id));
      if (firstElement && !result.includes(firstElement)) result.push(firstElement);
    }
    return result;
  } catch {
    return [];
  }
}

function trimFlatString(s: string): string {
  return s.trim();
}

function asFlatString(s: string): string {
  return s
    .split("\u00A0")
    .map((chunk) =>
      chunk
        .replace(/\r\n/g, "\n")
        .replace(/[\u200b\u00ad]/g, "")
        .replace(/\s\s*/g, " "),
    )
    .join("\u00A0")
    .trim();
}

function queryInAriaOwned(element: Element, selector: string): Element[] {
  const result = [...element.querySelectorAll(selector)];
  for (const owned of getIdRefs(element, element.getAttribute("aria-owns"))) {
    if (owned.matches(selector)) result.push(owned);
    result.push(...owned.querySelectorAll(selector));
  }
  return result;
}

export function getCSSContent(element: Element, pseudo?: "::before" | "::after") {
  const cache =
    pseudo === "::before"
      ? cachePseudoContentBefore
      : pseudo === "::after"
        ? cachePseudoContentAfter
        : cachePseudoContent;
  if (cache?.has(element)) return cache?.get(element);

  const style = getElementComputedStyle(element, pseudo);
  let content: string | undefined;
  if (style && style.display !== "none" && style.visibility !== "hidden") {
    content = parseCSSContentPropertyAsString(element, style.content, !!pseudo);
  }

  if (pseudo && content !== undefined) {
    const display = style?.display || "inline";
    if (display !== "inline") content = " " + content + " ";
  }

  if (cache) cache.set(element, content);
  return content;
}

function parseCSSContentPropertyAsString(
  element: Element,
  content: string,
  isPseudo: boolean,
): string | undefined {
  if (!content || content === "none" || content === "normal") {
    return;
  }

  try {
    let tokens = css.tokenize(content).filter((token) => !(token instanceof css.WhitespaceToken));
    const delimIndex = tokens.findIndex(
      (token) => token instanceof css.DelimToken && token.value === "/",
    );
    if (delimIndex !== -1) {
      tokens = tokens.slice(delimIndex + 1);
    } else if (!isPseudo) {
      return;
    }

    const accumulated: string[] = [];
    let index = 0;
    while (index < tokens.length) {
      if (tokens[index] instanceof css.StringToken) {
        accumulated.push(tokens[index].value as string);
        index++;
      } else if (
        index + 2 < tokens.length &&
        tokens[index] instanceof css.FunctionToken &&
        tokens[index].value === "attr" &&
        tokens[index + 1] instanceof css.IdentToken &&
        tokens[index + 2] instanceof css.CloseParenToken
      ) {
        const attrName = tokens[index + 1].value as string;
        accumulated.push(element.getAttribute(attrName) || "");
        index += 3;
      } else {
        return;
      }
    }
    return accumulated.join("");
  } catch {}
}

export function getAriaLabelledByElements(element: Element): Element[] | null {
  const ref = element.getAttribute("aria-labelledby");
  if (ref === null) return null;
  const refs = getIdRefs(element, ref);
  return refs.length ? refs : null;
}

function allowsNameFromContent(role: string, targetDescendant: boolean) {
  const alwaysAllowsNameFromContent = [
    "button",
    "cell",
    "checkbox",
    "columnheader",
    "gridcell",
    "heading",
    "link",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "radio",
    "row",
    "rowheader",
    "switch",
    "tab",
    "tooltip",
    "treeitem",
  ].includes(role);
  const descendantAllowsNameFromContent =
    targetDescendant &&
    [
      "",
      "caption",
      "code",
      "contentinfo",
      "definition",
      "deletion",
      "emphasis",
      "insertion",
      "list",
      "listitem",
      "mark",
      "none",
      "paragraph",
      "presentation",
      "region",
      "row",
      "rowgroup",
      "section",
      "strong",
      "subscript",
      "superscript",
      "table",
      "term",
      "time",
    ].includes(role);
  return alwaysAllowsNameFromContent || descendantAllowsNameFromContent;
}

export function getElementAccessibleName(element: Element, includeHidden: boolean): string {
  const cache = includeHidden ? cacheAccessibleNameHidden : cacheAccessibleName;
  let accessibleName = cache?.get(element);

  if (accessibleName === undefined) {
    accessibleName = "";

    const elementProhibitsNaming = [
      "caption",
      "code",
      "definition",
      "deletion",
      "emphasis",
      "generic",
      "insertion",
      "mark",
      "paragraph",
      "presentation",
      "strong",
      "subscript",
      "suggestion",
      "superscript",
      "term",
      "time",
    ].includes(getAriaRole(element) || "");

    if (!elementProhibitsNaming) {
      accessibleName = asFlatString(
        getTextAlternativeInternal(element, {
          includeHidden,
          visitedElements: new Set(),
          embeddedInTargetElement: "self",
        }),
      );
    }

    cache?.set(element, accessibleName);
  }
  return accessibleName;
}

type AccessibleNameOptions = {
  visitedElements: Set<Element>;
  includeHidden?: boolean;
  embeddedInDescribedBy?: { element: Element; hidden: boolean };
  embeddedInLabelledBy?: { element: Element; hidden: boolean };
  embeddedInLabel?: { element: Element; hidden: boolean };
  embeddedInNativeTextAlternative?: { element: Element; hidden: boolean };
  embeddedInTargetElement?: "self" | "descendant";
};

function getTextAlternativeInternal(element: Element, options: AccessibleNameOptions): string {
  if (options.visitedElements.has(element)) return "";

  const childOptions: AccessibleNameOptions = {
    ...options,
    embeddedInTargetElement:
      options.embeddedInTargetElement === "self" ? "descendant" : options.embeddedInTargetElement,
  };

  if (!options.includeHidden) {
    const isEmbeddedInHiddenReferenceTraversal =
      !!options.embeddedInLabelledBy?.hidden ||
      !!options.embeddedInDescribedBy?.hidden ||
      !!options.embeddedInNativeTextAlternative?.hidden ||
      !!options.embeddedInLabel?.hidden;
    if (
      isElementIgnoredForAria(element) ||
      (!isEmbeddedInHiddenReferenceTraversal && isElementHiddenForAria(element))
    ) {
      options.visitedElements.add(element);
      return "";
    }
  }

  const labelledBy = getAriaLabelledByElements(element);

  if (!options.embeddedInLabelledBy) {
    const accessibleName = (labelledBy || [])
      .map((ref) =>
        getTextAlternativeInternal(ref, {
          ...options,
          embeddedInLabelledBy: { element: ref, hidden: isElementHiddenForAria(ref) },
          embeddedInDescribedBy: undefined,
          embeddedInTargetElement: undefined,
          embeddedInLabel: undefined,
          embeddedInNativeTextAlternative: undefined,
        }),
      )
      .join(" ");
    if (accessibleName) return accessibleName;
  }

  const role = getAriaRole(element) || "";
  const tagName = elementSafeTagName(element);

  if (
    !!options.embeddedInLabel ||
    !!options.embeddedInLabelledBy ||
    options.embeddedInTargetElement === "descendant"
  ) {
    const isOwnLabel = [
      ...((element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).labels || []),
    ].includes(element as any);
    const isOwnLabelledBy = (labelledBy || []).includes(element);
    if (!isOwnLabel && !isOwnLabelledBy) {
      if (role === "textbox") {
        options.visitedElements.add(element);
        if (tagName === "INPUT" || tagName === "TEXTAREA")
          return (element as HTMLInputElement | HTMLTextAreaElement).value;
        return element.textContent || "";
      }
      if (["combobox", "listbox"].includes(role)) {
        options.visitedElements.add(element);
        let selectedOptions: Element[];
        if (tagName === "SELECT") {
          selectedOptions = [...(element as HTMLSelectElement).selectedOptions];
          if (!selectedOptions.length && (element as HTMLSelectElement).options.length)
            selectedOptions.push((element as HTMLSelectElement).options[0]);
        } else {
          const listbox =
            role === "combobox"
              ? queryInAriaOwned(element, "*").find((e) => getAriaRole(e) === "listbox")
              : element;
          selectedOptions = listbox
            ? queryInAriaOwned(listbox, '[aria-selected="true"]').filter(
                (e) => getAriaRole(e) === "option",
              )
            : [];
        }
        if (!selectedOptions.length && tagName === "INPUT") {
          return (element as HTMLInputElement).value;
        }
        return selectedOptions
          .map((option) => getTextAlternativeInternal(option, childOptions))
          .join(" ");
      }
      if (["progressbar", "scrollbar", "slider", "spinbutton", "meter"].includes(role)) {
        options.visitedElements.add(element);
        if (element.hasAttribute("aria-valuetext"))
          return element.getAttribute("aria-valuetext") || "";
        if (element.hasAttribute("aria-valuenow"))
          return element.getAttribute("aria-valuenow") || "";
        return element.getAttribute("value") || "";
      }
      if (["menu"].includes(role)) {
        options.visitedElements.add(element);
        return "";
      }
    }
  }

  const ariaLabel = element.getAttribute("aria-label") || "";
  if (trimFlatString(ariaLabel)) {
    options.visitedElements.add(element);
    return ariaLabel;
  }

  if (!["presentation", "none"].includes(role)) {
    if (
      tagName === "INPUT" &&
      ["button", "submit", "reset"].includes((element as HTMLInputElement).type)
    ) {
      options.visitedElements.add(element);
      const value = (element as HTMLInputElement).value || "";
      if (trimFlatString(value)) return value;
      if ((element as HTMLInputElement).type === "submit") return "Submit";
      if ((element as HTMLInputElement).type === "reset") return "Reset";
      const title = element.getAttribute("title") || "";
      return title;
    }

    if (tagName === "INPUT" && (element as HTMLInputElement).type === "file") {
      options.visitedElements.add(element);
      const labels = (element as HTMLInputElement).labels || [];
      if (labels.length && !options.embeddedInLabelledBy)
        return getAccessibleNameFromAssociatedLabels(labels, options);
      return "Choose File";
    }

    if (tagName === "INPUT" && (element as HTMLInputElement).type === "image") {
      options.visitedElements.add(element);
      const labels = (element as HTMLInputElement).labels || [];
      if (labels.length && !options.embeddedInLabelledBy)
        return getAccessibleNameFromAssociatedLabels(labels, options);
      const alt = element.getAttribute("alt") || "";
      if (trimFlatString(alt)) return alt;
      const title = element.getAttribute("title") || "";
      if (trimFlatString(title)) return title;
      return "Submit";
    }

    if (!labelledBy && tagName === "BUTTON") {
      options.visitedElements.add(element);
      const labels = (element as HTMLButtonElement).labels || [];
      if (labels.length) return getAccessibleNameFromAssociatedLabels(labels, options);
    }

    if (!labelledBy && tagName === "OUTPUT") {
      options.visitedElements.add(element);
      const labels = (element as HTMLOutputElement).labels || [];
      if (labels.length) return getAccessibleNameFromAssociatedLabels(labels, options);
      return element.getAttribute("title") || "";
    }

    if (!labelledBy && (tagName === "TEXTAREA" || tagName === "SELECT" || tagName === "INPUT")) {
      options.visitedElements.add(element);
      const labels =
        (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).labels || [];
      if (labels.length) return getAccessibleNameFromAssociatedLabels(labels, options);

      const usePlaceholder =
        (tagName === "INPUT" &&
          ["text", "password", "search", "tel", "email", "url"].includes(
            (element as HTMLInputElement).type,
          )) ||
        tagName === "TEXTAREA";
      const placeholder = element.getAttribute("placeholder") || "";
      const title = element.getAttribute("title") || "";
      if (!usePlaceholder || title) return title;
      return placeholder;
    }

    if (!labelledBy && tagName === "FIELDSET") {
      options.visitedElements.add(element);
      for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
        if (elementSafeTagName(child) === "LEGEND") {
          return getTextAlternativeInternal(child, {
            ...childOptions,
            embeddedInNativeTextAlternative: {
              element: child,
              hidden: isElementHiddenForAria(child),
            },
          });
        }
      }
      const title = element.getAttribute("title") || "";
      return title;
    }

    if (!labelledBy && tagName === "FIGURE") {
      options.visitedElements.add(element);
      for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
        if (elementSafeTagName(child) === "FIGCAPTION") {
          return getTextAlternativeInternal(child, {
            ...childOptions,
            embeddedInNativeTextAlternative: {
              element: child,
              hidden: isElementHiddenForAria(child),
            },
          });
        }
      }
      const title = element.getAttribute("title") || "";
      return title;
    }

    if (tagName === "IMG") {
      options.visitedElements.add(element);
      const alt = element.getAttribute("alt") || "";
      if (trimFlatString(alt)) return alt;
      const title = element.getAttribute("title") || "";
      return title;
    }

    if (tagName === "TABLE") {
      options.visitedElements.add(element);
      for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
        if (elementSafeTagName(child) === "CAPTION") {
          return getTextAlternativeInternal(child, {
            ...childOptions,
            embeddedInNativeTextAlternative: {
              element: child,
              hidden: isElementHiddenForAria(child),
            },
          });
        }
      }
      const summary = element.getAttribute("summary") || "";
      if (summary) return summary;
    }

    if (tagName === "AREA") {
      options.visitedElements.add(element);
      const alt = element.getAttribute("alt") || "";
      if (trimFlatString(alt)) return alt;
      const title = element.getAttribute("title") || "";
      return title;
    }

    if (tagName === "SVG" || (element as SVGElement).ownerSVGElement) {
      options.visitedElements.add(element);
      for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
        if (elementSafeTagName(child) === "TITLE" && (child as SVGElement).ownerSVGElement) {
          return getTextAlternativeInternal(child, {
            ...childOptions,
            embeddedInLabelledBy: { element: child, hidden: isElementHiddenForAria(child) },
          });
        }
      }
    }
    if ((element as SVGElement).ownerSVGElement && tagName === "A") {
      const title = element.getAttribute("xlink:title") || "";
      if (trimFlatString(title)) {
        options.visitedElements.add(element);
        return title;
      }
    }
  }

  const shouldNameFromContentForSummary =
    tagName === "SUMMARY" && !["presentation", "none"].includes(role);

  if (
    allowsNameFromContent(role, options.embeddedInTargetElement === "descendant") ||
    shouldNameFromContentForSummary ||
    !!options.embeddedInLabelledBy ||
    !!options.embeddedInDescribedBy ||
    !!options.embeddedInLabel ||
    !!options.embeddedInNativeTextAlternative
  ) {
    options.visitedElements.add(element);
    const accessibleName = innerAccumulatedElementText(element, childOptions);
    const maybeTrimmedAccessibleName =
      options.embeddedInTargetElement === "self" ? trimFlatString(accessibleName) : accessibleName;
    if (maybeTrimmedAccessibleName) return accessibleName;
  }

  if (!["presentation", "none"].includes(role) || tagName === "IFRAME") {
    options.visitedElements.add(element);
    const title = element.getAttribute("title") || "";
    if (trimFlatString(title)) return title;
  }

  options.visitedElements.add(element);
  return "";
}

function innerAccumulatedElementText(element: Element, options: AccessibleNameOptions): string {
  const tokens: string[] = [];
  const visit = (node: Node, skipSlotted: boolean) => {
    if (skipSlotted && (node as Element | Text).assignedSlot) return;
    if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
      const display = getElementComputedStyle(node as Element)?.display || "inline";
      let token = getTextAlternativeInternal(node as Element, options);
      if (display !== "inline" || node.nodeName === "BR") token = " " + token + " ";
      tokens.push(token);
    } else if (node.nodeType === 3 /* Node.TEXT_NODE */) {
      tokens.push(node.textContent || "");
    }
  };
  tokens.push(getCSSContent(element, "::before") || "");
  const content = getCSSContent(element);
  if (content !== undefined) {
    tokens.push(content);
  } else {
    const assignedNodes =
      element.nodeName === "SLOT" ? (element as HTMLSlotElement).assignedNodes() : [];
    if (assignedNodes.length) {
      for (const child of assignedNodes) visit(child, false);
    } else {
      for (let child = element.firstChild; child; child = child.nextSibling) visit(child, true);
      if (element.shadowRoot) {
        for (let child = element.shadowRoot.firstChild; child; child = child.nextSibling)
          visit(child, true);
      }
      for (const owned of getIdRefs(element, element.getAttribute("aria-owns"))) visit(owned, true);
    }
  }
  tokens.push(getCSSContent(element, "::after") || "");
  return tokens.join("");
}

export const kAriaSelectedRoles = [
  "gridcell",
  "option",
  "row",
  "tab",
  "rowheader",
  "columnheader",
  "treeitem",
];
export function getAriaSelected(element: Element): boolean {
  if (elementSafeTagName(element) === "OPTION") return (element as HTMLOptionElement).selected;
  if (kAriaSelectedRoles.includes(getAriaRole(element) || ""))
    return getAriaBoolean(element.getAttribute("aria-selected")) === true;
  return false;
}

export const kAriaCheckedRoles = [
  "checkbox",
  "menuitemcheckbox",
  "option",
  "radio",
  "switch",
  "menuitemradio",
  "treeitem",
];
export function getAriaChecked(element: Element): boolean | "mixed" {
  const result = getChecked(element, true);
  return result === "error" ? false : result;
}

function getChecked(element: Element, allowMixed: boolean): boolean | "mixed" | "error" {
  const tagName = elementSafeTagName(element);
  if (allowMixed && tagName === "INPUT" && (element as HTMLInputElement).indeterminate)
    return "mixed";
  if (tagName === "INPUT" && ["checkbox", "radio"].includes((element as HTMLInputElement).type))
    return (element as HTMLInputElement).checked;
  if (kAriaCheckedRoles.includes(getAriaRole(element) || "")) {
    const checked = element.getAttribute("aria-checked");
    if (checked === "true") return true;
    if (allowMixed && checked === "mixed") return "mixed";
    return false;
  }
  return "error";
}

export const kAriaPressedRoles = ["button"];
export function getAriaPressed(element: Element): boolean | "mixed" {
  if (kAriaPressedRoles.includes(getAriaRole(element) || "")) {
    const pressed = element.getAttribute("aria-pressed");
    if (pressed === "true") return true;
    if (pressed === "mixed") return "mixed";
  }
  return false;
}

export const kAriaExpandedRoles = [
  "application",
  "button",
  "checkbox",
  "combobox",
  "gridcell",
  "link",
  "listbox",
  "menuitem",
  "row",
  "rowheader",
  "tab",
  "treeitem",
  "columnheader",
  "menuitemcheckbox",
  "menuitemradio",
  "rowheader",
  "switch",
];
export function getAriaExpanded(element: Element): boolean | undefined {
  if (elementSafeTagName(element) === "DETAILS") return (element as HTMLDetailsElement).open;
  if (kAriaExpandedRoles.includes(getAriaRole(element) || "")) {
    const expanded = element.getAttribute("aria-expanded");
    if (expanded === null) return undefined;
    if (expanded === "true") return true;
    return false;
  }
  return undefined;
}

export const kAriaLevelRoles = ["heading", "listitem", "row", "treeitem"];
export function getAriaLevel(element: Element): number {
  const native = { H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6 }[elementSafeTagName(element)];
  if (native) return native;
  if (kAriaLevelRoles.includes(getAriaRole(element) || "")) {
    const attr = element.getAttribute("aria-level");
    const value = attr === null ? Number.NaN : Number(attr);
    if (Number.isInteger(value) && value >= 1) return value;
  }
  return 0;
}

export const kAriaDisabledRoles = [
  "application",
  "button",
  "composite",
  "gridcell",
  "group",
  "input",
  "link",
  "menuitem",
  "scrollbar",
  "separator",
  "tab",
  "checkbox",
  "columnheader",
  "combobox",
  "grid",
  "listbox",
  "menu",
  "menubar",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "radiogroup",
  "row",
  "rowheader",
  "searchbox",
  "select",
  "slider",
  "spinbutton",
  "switch",
  "tablist",
  "textbox",
  "toolbar",
  "tree",
  "treegrid",
  "treeitem",
];
export function getAriaDisabled(element: Element): boolean {
  return isNativelyDisabled(element) || hasExplicitAriaDisabled(element);
}

function isNativelyDisabled(element: Element) {
  const isNativeFormControl = [
    "BUTTON",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "OPTION",
    "OPTGROUP",
  ].includes(element.tagName);
  return (
    isNativeFormControl && (element.hasAttribute("disabled") || belongsToDisabledFieldSet(element))
  );
}

function belongsToDisabledFieldSet(element: Element): boolean {
  const fieldSetElement = element?.closest("FIELDSET[DISABLED]");
  if (!fieldSetElement) return false;
  const legendElement = fieldSetElement.querySelector(":scope > LEGEND");
  return !legendElement || !legendElement.contains(element);
}

function hasExplicitAriaDisabled(element: Element | undefined, isAncestor = false): boolean {
  if (!element) return false;
  if (isAncestor || kAriaDisabledRoles.includes(getAriaRole(element) || "")) {
    const attribute = (element.getAttribute("aria-disabled") || "").toLowerCase();
    if (attribute === "true") return true;
    if (attribute === "false") return false;
    return hasExplicitAriaDisabled(parentElementOrShadowHost(element), true);
  }
  return false;
}

function getAccessibleNameFromAssociatedLabels(
  labels: Iterable<HTMLLabelElement>,
  options: AccessibleNameOptions,
) {
  return [...labels]
    .map((label) =>
      getTextAlternativeInternal(label, {
        ...options,
        embeddedInLabel: { element: label, hidden: isElementHiddenForAria(label) },
        embeddedInNativeTextAlternative: undefined,
        embeddedInLabelledBy: undefined,
        embeddedInDescribedBy: undefined,
        embeddedInTargetElement: undefined,
      }),
    )
    .filter((accessibleName) => !!accessibleName)
    .join(" ");
}

export function receivesPointerEvents(element: Element): boolean {
  const cache = cachePointerEvents!;
  let e: Element | undefined = element;
  let result: boolean | undefined;
  const parents: Element[] = [];
  for (; e; e = parentElementOrShadowHost(e!)) {
    const cached = cache.get(e);
    if (cached !== undefined) {
      result = cached;
      break;
    }

    parents.push(e);
    const style = getElementComputedStyle(e);
    if (!style) {
      result = true;
      break;
    }

    const value = style.pointerEvents;
    if (value) {
      result = value !== "none";
      break;
    }
  }

  if (result === undefined) result = true;

  for (const parent of parents) cache.set(parent, result);
  return result;
}

let cacheAccessibleName: Map<Element, string> | undefined;
let cacheAccessibleNameHidden: Map<Element, string> | undefined;
let cacheIsHidden: Map<Element, boolean> | undefined;
let cachePseudoContent: Map<Element, string | undefined> | undefined;
let cachePseudoContentBefore: Map<Element, string | undefined> | undefined;
let cachePseudoContentAfter: Map<Element, string | undefined> | undefined;
let cachePointerEvents: Map<Element, boolean> | undefined;
let cachesCounter = 0;

export function beginAriaCaches() {
  ++cachesCounter;
  cacheAccessibleName ??= new Map();
  cacheAccessibleNameHidden ??= new Map();
  cacheIsHidden ??= new Map();
  cachePseudoContent ??= new Map();
  cachePseudoContentBefore ??= new Map();
  cachePseudoContentAfter ??= new Map();
  cachePointerEvents ??= new Map();
}

export function endAriaCaches() {
  if (!--cachesCounter) {
    cacheAccessibleName = undefined;
    cacheAccessibleNameHidden = undefined;
    cacheIsHidden = undefined;
    cachePseudoContent = undefined;
    cachePseudoContentBefore = undefined;
    cachePseudoContentAfter = undefined;
    cachePointerEvents = undefined;
  }
}

const inputTypeToRole: Record<string, AriaRole> = {
  button: "button",
  checkbox: "checkbox",
  image: "button",
  number: "spinbutton",
  radio: "radio",
  range: "slider",
  reset: "button",
  submit: "button",
};
