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
//# sourceMappingURL=misc.js.map