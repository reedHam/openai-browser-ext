import { debounce } from 'lodash';

const DEBUG = false;

export type DocumentSelectorContext = Document | Element;

export const $x = (xp: string, context: DocumentSelectorContext = document) => {
    const snapshot = document.evaluate(
        xp,
        context,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
    );
    return [...Array(snapshot.snapshotLength)]
        .map((_, i) => snapshot.snapshotItem(i))
        .filter((ele) => ele !== null) as HTMLElement[];
};

export function documentSelector(
    selector: string,
    context: DocumentSelectorContext = document
): HTMLElement | null {
    if (selector.startsWith('/')) {
        if ($x(selector)[0]) {
            return $x(selector, context)[0];
        }
    } else {
        const elm = context.querySelector(selector) as HTMLElement | null;
        if (elm) {
            return elm;
        }
    }
    return null;
}

export function documentSelectorAll(
    selector: string,
    context: DocumentSelectorContext = document
): HTMLElement[] {
    if (selector.startsWith('/')) {
        const elms = $x(selector, context);
        if (elms.length) {
            return elms;
        }
    } else {
        const elms = Array.from(
            context.querySelectorAll(selector)
        ) as HTMLElement[];
        if (elms) {
            return elms;
        }
    }
    return [];
}

/**
 * Creates a promise that waits for the element to exist.
 * @param {String} selector Selects the element to wait for.
 * @returns {Promise<HTMLElement>} Returns a promise that resolves to the element.
 */
export function waitForElm(
    selector: string,
    context?: HTMLElement
): Promise<HTMLElement> {
    if (DEBUG) console.log('waitForElm', selector);
    return new Promise((resolve, reject) => {
        // eslint-disable-next-line prefer-const
        let timeout: NodeJS.Timeout;

        const observer = new MutationObserver((mutations) => {
            const elm = documentSelector(selector, context);
            if (elm) {
                observer.disconnect();
                if (DEBUG) console.log('found elm for', selector);
                clearTimeout(timeout);
                resolve(elm);
            }
        });

        timeout = setTimeout(() => {
            observer.disconnect();
            reject(new Error('waitForElm timeout on ' + selector));
        }, 10000);

        const elm = documentSelector(selector, context);
        if (elm) {
            if (DEBUG) console.log('found elm for', selector);
            clearTimeout(timeout);
            resolve(elm);
        }

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    });
}

type ElementValidator = (ele: HTMLElement) => boolean;

/**
 * Starting from ele using depth first search find the element that matches the selector.
 * @param {HTMLElement} ele
 * @param {String} selector css selector
 * @returns HTMLElement or null if not found.
 */
export function findInFamily(
    ele: HTMLElement,
    validator: ElementValidator
): HTMLElement | null {
    const checkedNodes = new Set<HTMLElement>();
    if (DEBUG) console.log('findInFamily', ele, validator);
    const findNode = (ele: HTMLElement): HTMLElement | null => {
        if (!checkedNodes.has(ele)) {
            checkedNodes.add(ele);

            if (validator(ele)) {
                if (DEBUG) console.log('found node', ele);
                return ele;
            }

            for (const child of ele.children) {
                const found = findNode(child as HTMLElement);
                if (found) {
                    if (DEBUG) console.log('found node', ele);
                    return found;
                }
            }

            if (ele.parentElement) {
                return findNode(ele.parentElement);
            }
        }
        return null;
    };

    return findNode(ele);
}

export const documentSelectAllAtPoint = (
    x: number,
    y: number,
    options: { context?: HTMLElement; validator?: ElementValidator } = {}
) => {
    const { context, validator } = options;
    let foundElements: Element[] = [];
    foundElements = document.elementsFromPoint(x, y);
    if (context instanceof Element) {
        const contextIndex = foundElements.indexOf(context);
        if (contextIndex === -1) return [];
        foundElements = foundElements.slice(0, contextIndex);
    }
    if (validator) {
        foundElements = foundElements.filter((ele) =>
            validator(ele as HTMLElement)
        );
    }
    return foundElements;
};

export const documentSelectAtPoint = (
    x: number,
    y: number,
    options: { context?: HTMLElement; validator?: ElementValidator } = {}
) => {
    const { context, validator } = options;
    const foundElements = documentSelectAllAtPoint(x, y, { context });
    if (validator) {
        return foundElements.find((ele) => validator(ele as HTMLElement));
    }
    return foundElements.shift();
};

export type DocumentSelectionDirections = 'up' | 'down' | 'left' | 'right';

export function documentSelectDirection(
    element: HTMLElement,
    direction: DocumentSelectionDirections,
    options: {
        wrapAround?: boolean;
        maxDistance?: number;
        context?: HTMLElement;
    } = {}
) {
    const {
        wrapAround = false,
        maxDistance = 1000,
        context = undefined,
    } = options;
    const rect = element.getBoundingClientRect();
    const halfWidth = rect.x + rect.width / 2;
    const halfHeight = rect.y + rect.height / 2;

    const search =
        (
            getNextSearch: () => { x: number; y: number },
            incrementDistance: () => void
        ) =>
        () => {
            const { x: searchX, y: searchY } = getNextSearch();
            incrementDistance();
            return documentSelectAtPoint(searchX, searchY, { context });
        };

    const searchUntilLimits = (searchFn: () => Element | undefined) => {
        while (searchDistance < maxDistance) {
            const result = searchFn();
            if (result) return result;
        }
    };

    let searchDistance = 1;
    switch (direction) {
        case 'up': {
            const searchUp = search(
                () => {
                    let nextSearch = rect.top - searchDistance;
                    if (wrapAround) {
                        if (context) {
                            const contextRect = context.getBoundingClientRect();
                            if (nextSearch < contextRect.top) {
                                nextSearch = contextRect.bottom - 1;
                            }
                        } else {
                            nextSearch =
                                nextSearch <= 0
                                    ? window.innerHeight
                                    : nextSearch;
                        }
                    }
                    return {
                        x: halfWidth,
                        y: nextSearch,
                    };
                },
                () => (searchDistance += halfHeight)
            );
            return searchUntilLimits(searchUp);
        }
        case 'down': {
            const searchDown = search(
                () => {
                    let nextSearch = rect.bottom + searchDistance;
                    if (wrapAround) {
                        if (context) {
                            const contextRect = context.getBoundingClientRect();
                            if (
                                nextSearch >
                                contextRect.y + contextRect.height
                            ) {
                                nextSearch = contextRect.top + 1;
                            }
                        } else {
                            nextSearch = nextSearch % window.innerHeight;
                        }
                    }
                    return {
                        x: halfWidth,
                        y: nextSearch,
                    };
                },
                () => (searchDistance += halfHeight)
            );
            return searchUntilLimits(searchDown);
        }
        case 'left': {
            const searchLeft = search(
                () => {
                    let nextSearch = rect.left - searchDistance;
                    if (wrapAround) {
                        if (context) {
                            const contextRect = context.getBoundingClientRect();
                            if (nextSearch < contextRect.left) {
                                nextSearch = contextRect.right - 1;
                            }
                        } else {
                            nextSearch =
                                nextSearch <= 0
                                    ? window.innerWidth
                                    : nextSearch;
                        }
                    }
                    return {
                        x: nextSearch,
                        y: halfHeight,
                    };
                },
                () => (searchDistance += halfWidth)
            );
            return searchUntilLimits(searchLeft);
        }
        case 'right': {
            const searchRight = search(
                () => {
                    let nextSearch = rect.right + searchDistance;
                    if (wrapAround) {
                        if (context) {
                            const contextRect = context.getBoundingClientRect();
                            if (nextSearch > contextRect.right) {
                                nextSearch = contextRect.left + 1;
                            }
                        } else {
                            nextSearch = nextSearch % window.innerWidth;
                        }
                    }
                    return {
                        x: nextSearch,
                        y: halfHeight,
                    };
                },
                () => (searchDistance += halfWidth)
            );
            return searchUntilLimits(searchRight);
        }
    }
}

export function getSouthElement(
    element: Element,
    options: {
        wrapAround?: boolean;
        maxDistance?: number;
        context?: HTMLElement;
    } = {}
) {
    const {
        wrapAround = false,
        maxDistance = Infinity,
        context = undefined,
    } = options;
    const rect = element.getBoundingClientRect();
    const halfWidth = rect.x + rect.width / 2;
    const bottom = rect.y + rect.height;

    let searchDistance = 1;
    const searchBottom = () => {
        let nextSearch = bottom + searchDistance;

        if (wrapAround) {
            if (context) {
                const contextRect = context.getBoundingClientRect();
                if (nextSearch > contextRect.y + contextRect.height) {
                    nextSearch =
                        (nextSearch % contextRect.bottom) + contextRect.y;
                }
            } else {
                nextSearch = nextSearch % window.innerHeight;
            }
        }
        const element = documentSelectAtPoint(halfWidth, nextSearch, {
            context,
        });
        searchDistance = searchDistance * 2;
        return element;
    };

    let southElement = searchBottom();
    while (!southElement && bottom + searchDistance < window.innerHeight) {
        southElement = searchBottom();
    }

    return southElement;
}

export function scrollPage() {
    window.scrollTo(0, document.body.scrollHeight);
}

export function* autoIncrementIDGenerator(
    initialID = 0
): Generator<number, never, number> {
    let id = initialID;
    while (id < Number.MAX_SAFE_INTEGER) {
        yield ++id;
    }
    throw new Error('Max Auto Increment ID reached');
}

const globalIDGenerator = autoIncrementIDGenerator();
export const getNextGlobalID = () => globalIDGenerator.next().value;

type HandlerFunction = (
    id: ReturnType<typeof getNextGlobalID>,
    element: HTMLElement
) => any;

export class ElementRancher {
    static instance: ElementRancher;

    ELEMENT_WATCHER_ID = getNextGlobalID();
    ELEMENT_WATCHES!: Map<
        number,
        [selector: string, handlerFunction: HandlerFunction]
    >;
    observer!: MutationObserver;

    constructor() {
        if (ElementRancher.instance) {
            return ElementRancher.instance;
        }
        ElementRancher.instance = this;

        this.ELEMENT_WATCHES = new Map();
        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node instanceof HTMLElement) {
                        this.runHandlers();
                    }
                }
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    runHandlers = debounce(() => {
        for (const [
            watchID,
            [selector, handlerFunction],
        ] of this.ELEMENT_WATCHES.entries()) {
            const elements = documentSelectorAll(selector);
            for (const element of elements) {
                handlerFunction(watchID, element);
            }
        }
    }, 150);

    addHandler(selector: string, handlerFunction: HandlerFunction) {
        const watchID = getNextGlobalID();
        this.ELEMENT_WATCHES.set(watchID, [selector, handlerFunction]);
        document.body.dispatchEvent(new Event('mutation'));
        return watchID;
    }
}

type KeyboardEventHandler = (event: KeyboardEvent) => void;

export const handleArrowKeys =
    ({
        up,
        down,
        left,
        right,
    }: {
        up?: KeyboardEventHandler;
        down?: KeyboardEventHandler;
        left?: KeyboardEventHandler;
        right?: KeyboardEventHandler;
    }) =>
    (event: KeyboardEvent) => {
        switch (event.key) {
            case 'ArrowDown':
                down && down(event);
                break;
            case 'ArrowUp':
                up && up(event);
                break;
            case 'ArrowLeft':
                left && left(event);
                break;
            case 'ArrowRight':
                right && right(event);
                break;
            default:
                break;
        }
    };
