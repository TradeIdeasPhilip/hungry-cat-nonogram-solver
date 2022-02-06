// TODO Why do I have to keep copying this file?  Need a better way to do libraries.

/**
 * This is a wrapper around setTimeout() that works with await.
 *
 * `await sleep(100)`;
 * @param ms How long in milliseconds to sleep.
 * @returns A promise that you can wait on.
 */
export function sleep(ms: number) {
  // https://stackoverflow.com/a/39914235/971955
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * On success `parsed` points to the XML Document.
 * On success `error` points to an HTMLElement explaining the problem.
 * Exactly one of those two fields will be undefined.
 */
export type XmlStatus =
  | { parsed: Document; error?: undefined }
  | { parsed?: undefined; error: HTMLElement };

/**
 * Check if the input is a valid XML file.
 * @param xmlStr The input to be parsed.
 * @returns If the input valid, return the XML document.  If the input is invalid, this returns an HTMLElement explaining the problem.
 */
export function testXml(xmlStr: string): XmlStatus {
  const parser = new DOMParser();
  const dom = parser.parseFromString(xmlStr, "application/xml");
  // https://developer.mozilla.org/en-US/docs/Web/API/DOMParser/parseFromString
  // says that parseFromString() will throw an error if the input is invalid.
  //
  // https://developer.mozilla.org/en-US/docs/Web/Guide/Parsing_and_serializing_XML
  // says dom.documentElement.nodeName == "parsererror" will be true of the input
  // is invalid.
  //
  // Neither of those is true when I tested it in Chrome.  Nothing is thrown.
  // If the input is "" I get:
  // dom.documentElement.nodeName returns "html",
  // doc.documentElement.firstElementChild.nodeName returns "body" and
  // doc.documentElement.firstElementChild.firstElementChild.nodeName = "parsererror".
  // It seems that the <parsererror> can move around.  It looks like it's trying to
  // create as much of the XML tree as it can, then it inserts <parsererror> whenever
  // and wherever it gets stuck.  It sometimes generates additional XML after the
  // parsererror, so .lastElementChild might not find the problem.
  //
  // In case of an error the <parsererror> element will be an instance of
  // HTMLElement.  A valid XML document can include an element with name name
  // "parsererror", however it will NOT be an instance of HTMLElement.
  //
  // getElementsByTagName('parsererror') might be faster than querySelectorAll().
  for (const element of Array.from(dom.querySelectorAll("parsererror"))) {
    if (element instanceof HTMLElement) {
      // Found the error.
      return { error: element };
    }
  }
  // No errors found.
  return { parsed: dom };
}

/**
 * Pick any arbitrary element from the set.
 * @param set
 * @returns An item in the set.  Unless the set is empty, then it returns undefined.
 */
export function pickAny<T>(set: ReadonlySet<T>): T | undefined {
  const first = set.values().next();
  if (first.done) {
    return undefined;
  } else {
    return first.value;
  }
}

/**
 *
 * @param a
 * @param b
 * @returns A new set containing every element that was in `a` and in `b`.
 */
export function intersection<T>(a: ReadonlySet<T>, b: ReadonlySet<T>) {
  // Adapted from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
  return new Set([...a].filter((x) => b.has(x)));
}

/**
 *
 * @param array Pick from here.
 * @returns A randomly selected element of the array.
 * @throws An error if the array is empty.
 */
export function pick<T>(array: T[]): T {
  return array[(Math.random() * array.length) | 0];
}

// https://dev.to/chrismilson/zip-iterator-in-typescript-ldm
type Iterableify<T> = { [K in keyof T]: Iterable<T[K]> }
/**
 * Given a list of iterables, make a single iterable.
 * The resulting iterable will contain arrays.
 * The first entry in the output will contain the first entry in each of the inputs.
 * The nth entry in the output will contain the nth entry in each of the inputs.
 * This will stop iterating when the first of the inputs runs out of data.
 * ```
 *   for (const [rowHeader, rowBody] of zip(sharedStuff.rowHeaders, thisTable.rowBodies)) {
 *     ...
 *   }
 * ```
 * @param toZip Any number of iterables.
 */
export function* zip<T extends Array<any>>(
  ...toZip: Iterableify<T>
): Generator<T> {
  // Get iterators for all of the iterables.
  const iterators = toZip.map(i => i[Symbol.iterator]())

  while (true) {
      // Advance all of the iterators.
      const results = iterators.map(i => i.next())

      // If any of the iterators are done, we should stop.
      if (results.some(({ done }) => done)) {
          break
      }

      // We can assert the yield type, since we know none
      // of the iterators are done.
      yield results.map(({ value }) => value) as T
  }
}

export function *count(start = 0, end = Infinity, step = 1){
  for (let i = start; i < end; i += step) {
    yield i;
  }
}