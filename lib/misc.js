export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function testXml(xmlStr) {
    const parser = new DOMParser();
    const dom = parser.parseFromString(xmlStr, "application/xml");
    for (const element of Array.from(dom.querySelectorAll("parsererror"))) {
        if (element instanceof HTMLElement) {
            return { error: element };
        }
    }
    return { parsed: dom };
}
export function pickAny(set) {
    const first = set.values().next();
    if (first.done) {
        return undefined;
    }
    else {
        return first.value;
    }
}
export function intersection(a, b) {
    return new Set([...a].filter((x) => b.has(x)));
}
export function pick(array) {
    return array[(Math.random() * array.length) | 0];
}
export function* zip(...toZip) {
    const iterators = toZip.map(i => i[Symbol.iterator]());
    while (true) {
        const results = iterators.map(i => i.next());
        if (results.some(({ done }) => done)) {
            break;
        }
        yield results.map(({ value }) => value);
    }
}
export function* count(start = 0, end = Infinity, step = 1) {
    for (let i = start; i < end; i += step) {
        yield i;
    }
}
export function sum(items) {
    return items.reduce((accumulator, current) => accumulator + current, 0);
}
//# sourceMappingURL=misc.js.map