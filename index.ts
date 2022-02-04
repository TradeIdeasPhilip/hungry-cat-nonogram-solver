import { getById } from "./lib/client-misc.js";

/**
 * This is what you might see at the top of a column or on the left of a row.
 * There is one of these for each color.
 *
 * This object is immutable.
 * It contains the totals that we expect to see in the row or column.
 * This does **not** change based on what we currently this is in that row or column.
 */
type ColorRequirements = {
  readonly count: number;
  readonly allInARow?: boolean;
};

/**
 * Keep track of the cell's color.
 *
 * Initially the cell could be any color.
 * We can only eliminate possible colors, not add them.
 *
 * The cell's color is `known()` when all but one possibility has been eliminated.
 */
class CellColor {
  private readonly possible = new Set<number>();
  /**
   *
   * @param colorCount The total number of colors in the `Puzzle`.
   * Internally we use the numbers 0 to `colorCount - 1` to represent the colors.
   * When `Puzzle` reports to the main program it uses this number as an index into
   * PuzzleDescription.colors.
   */
  constructor(colorCount: number) {
    for (let i = 0; i < colorCount; i++) {
      this.possible.add(i);
    }
  }
  /**
   * The cell's color is `known()` when all but one possibility has been eliminated.
   */
  get known(): boolean {
    return this.possible.size == 1;
  }
  /**
   * If the correct color is `known()` then return that color.
   * Otherwise return undefined.
   */
  get color(): number | undefined {
    if (this.possible.size != 1) {
      return undefined;
    }
    for (const colorIndex of this.possible) {
      return colorIndex;
    }
  }
  /**
   * Mark the color as impossible.
   * If the color was already eliminated, do nothing.
   * @param color The color to eliminate.
   * @throws If you eliminate all colors, this will throw an exception.
   */
  eliminate(color: number) {
    this.possible.delete(color);
    if (this.possible.size == 0) {
      throw new Error("wtf");
    }
  }
  /**
   * Eliminate all colors except those found in `allowed`.
   * @param allowed Do *not* eliminate these.
   */
  limitTo(allowed: { has(index: number): boolean }) {
    [...this.possible].forEach((toCheck) => {
      if (!allowed.has(toCheck)) {
        this.eliminate(toCheck);
      }
    });
  }
  isPossible(color: number) {
    return this.possible.has(color);
  }
}

/**
 * The problem statement.  What the puzzle looks like before you make your first move.
 *
 * This will often be translated to and from JSON.
 */
type PuzzleDescription = {
  /**
   * The colors found in the puzzle.
   * The code that solves the puzzle only refers to the colors by number.
   * Those numbers are indexes into this array.
   *
   * The main program will use these strings to display results to the end user.
   * These should be HTML color strings.
   */
  readonly colors: string[];
  /**
   * `rows[rowNumber][colorIndex]` will give you the detail for that color on that row.
   */
  readonly rows: ReadonlyArray<ReadonlyArray<ColorRequirements>>;
  /**
   * `columns[columnNumber][colorIndex]` will give you the detail for that color on that column.
   */
  readonly columns: ReadonlyArray<ReadonlyArray<ColorRequirements>>;
};

/**
 *
 * @param possible A JSON encoded `PuzzleDescription`.
 * @returns The result of decoding the JSON string.
 * @throws This function always verifies that the result is a valid `PuzzleDescription`.
 * If the result is not valid, throw an `Error`.
 *
 * The message in the `Error` is aimed at someone trying to find the specific problem.
 * It's aimed at a programmer who has access to this source code.
 */
function decodePuzzleDescription(possible: string): PuzzleDescription {
  const result: PuzzleDescription = JSON.parse(possible);
  result.colors.forEach((color) => {
    if (typeof color !== "string") {
      throw new Error("colors should be a list of strings.");
    }
  });
  const colorCount = result.colors.length;
  function testColorRequirements(requirements: ColorRequirements) {
    if (!Number.isInteger(requirements.count)) {
      throw new Error("count should be an integer.");
    }
    if (requirements.count < 0) {
      throw new Error("count should be a non-negative integer.");
    }
    if (requirements.count < 2) {
      if (requirements.allInARow !== undefined) {
        throw new Error("if count < 2, allInARow should be undefined");
      }
    } else {
      if (typeof requirements.allInARow !== "boolean") {
        throw new Error("if count ≥ 2, allInARow should be boolean");
      }
    }
  }
  result.rows.forEach((header, index) => {
    if (header.length != colorCount) {
      throw new Error(
        `Expecting ${colorCount} color requirements, found ${header.length}, in row #${index}`
      );
    }
    header.forEach((requirements) => {
      testColorRequirements(requirements);
    });
  });
  result.columns.forEach((header, index) => {
    if (header.length != colorCount) {
      throw new Error(
        `Expecting ${colorCount} color requirements, found ${header.length}, in column #${index}`
      );
    }
    header.forEach((requirements) => {
      testColorRequirements(requirements);
    });
  });
  return result;
}

/**
 * This is the information that `Puzzle` knows about each row and each column.
 * Rows and columns are completely interchangeable.
 */
type RowOrColumn = {
  /**
   * Which row or column is this?
   */
  readonly index: number;
  /**
   * If `x` is a row, then `x.cross` is the list of all columns.
   * If `x` is a column, then `x.cross` is the list of all rows.
   * Requirement:  `x.cross.length == x.cells.length`
   */
  readonly cross: ReadonlyArray<RowOrColumn>;
  /**
   * The individual cells in this row or column.
   *
   * `x.cells[i] == x.cross.cells[x.index]`
   */
  readonly cells: ReadonlyArray<CellColor>;
  /**
   * A list of requirements, indexed by color.
   */
  readonly requirements: ReadonlyArray<ColorRequirements>;
};

class Puzzle {
  private readonly rows: ReadonlyArray<RowOrColumn>;
  private readonly columns: ReadonlyArray<RowOrColumn>;
  getRow(index : number) : ProposedRowOrColumn {
    const result = this.rows[0];
    if (!result) {
      throw new Error(`Unknown row number: ${index}`);
    }
    return new ProposedRowOrColumn(result);
  }
  getColumn(index : number) : ProposedRowOrColumn {
    const result = this.columns[0];
    if (!result) {
      throw new Error(`Unknown column number: ${index}`);
    }
    return new ProposedRowOrColumn(result);
  }
  constructor(public readonly description: PuzzleDescription) {
    const colorCount = description.colors.length;
    const cellsRowColumn: CellColor[][] = [];
    description.rows.forEach((rowRequirements) => {
      const cellsThisRow: CellColor[] = [];
      cellsRowColumn.push(cellsThisRow);
      description.columns.forEach((columnRequirements) => {
        cellsThisRow.push(new CellColor(colorCount));
      });
    });
    const cellsColumnRow: CellColor[][] = [];
    description.columns.forEach((columnRequirements, columnIndex) => {
      const cellsThisColumn: CellColor[] = [];
      cellsColumnRow.push(cellsThisColumn);
      description.rows.forEach((rowRequirements, rowIndex) => {
        const cell = cellsRowColumn[rowIndex][columnIndex];
        cellsThisColumn.push(cell);
      });
    });
    const rows: RowOrColumn[] = [];
    const columns: RowOrColumn[] = [];
    this.rows = rows;
    this.columns = columns;
    description.rows.forEach((requirements, index) => {
      rows.push({
        cells: cellsRowColumn[index],
        cross: columns,
        index,
        requirements,
      });
    });
    description.columns.forEach((requirements, index) => {
      columns.push({
        cells: cellsColumnRow[index],
        cross: columns,
        index,
        requirements,
      });
    });
  }
  /**
   *
   * @returns An array, one element per row, of
   * an array, one element per cell of
   * a color or undefined if we don't yet know the color.
   *
   * The color comes from PuzzleDescription.colors.
   */
  forDisplay(): (string | undefined)[][] {
    return this.rows.map((row) =>
      row.cells.map((cellColor) => {
        const color = cellColor.color;
        if (color === undefined) {
          return undefined;
        } else {
          return this.description.colors[color];
        }
      })
    );
  }
  /**
   * A very simple start.  This just looks at the original requirements for each row and column.
   *
   * This only looks at one cell at a time.
   * I.e. filling in data about one cell will not help this algorithm work on other cells.
   */
  checkIntersections(): void {
    function allowed(allRequirements: readonly ColorRequirements[]) {
      const result = new Set<number>();
      allRequirements.forEach((colorRequirements, color) => {
        if (colorRequirements.count > 0) {
          result.add(color);
        }
      });
      return result;
    }
    const allowedInColumn = this.columns.map((column) =>
      allowed(column.requirements)
    );
    this.rows.forEach((row) => {
      const allowedInRow = allowed(row.requirements);
      row.cells.forEach((cellColor, columnIndex) => {
        cellColor.limitTo(allowedInRow);
        cellColor.limitTo(allowedInColumn[columnIndex]);
      });
    });
  }
}

function showPuzzle(destination: HTMLTableElement, source: Puzzle) {
  destination.innerText = "";
  const forDisplay = source.forDisplay();
  forDisplay.forEach((rowSource) => {
    const row = destination.insertRow();
    rowSource.forEach((cellStyle) => {
      const cell = row.insertCell();
      cell.style.width = "1em";
      if (cellStyle !== undefined) {
        cell.style.background = cellStyle;
      }
    });
  });
  hcn.lastShown = source;
}

const requirementsTextArea = getById("requirements", HTMLTextAreaElement);
const loadButton = getById("load", HTMLButtonElement);
const outputTable = getById("output", HTMLTableElement);

loadButton.addEventListener("click", () => {
  const description = decodePuzzleDescription(requirementsTextArea.value);
  const puzzle = new Puzzle(description);
  puzzle.checkIntersections();
  showPuzzle(outputTable, puzzle);
});

const colorsTextArea = getById("colors", HTMLTextAreaElement);
const columnsTextArea = getById("columns", HTMLTextAreaElement);
const rowsTextArea = getById("rows", HTMLTextAreaElement);
const load3PartsButton = getById("load3Parts", HTMLButtonElement);
const colorSamplesDiv = getById("colorSamples", HTMLDivElement);

const endOfLine = /\r?\n/g;

function getColorsFromGUI() : string[] {
  const result: string[] = [];
  colorsTextArea.value.split(endOfLine).forEach((line) => {
    line = line.trim();
    if (line != "") {
      result.push(line);
    }
  });
  return result;
}

function updateColorSamples() {
  colorSamplesDiv.innerText = "";
  const colors = getColorsFromGUI();
  colors.forEach((color) => {
    const span = document.createElement("span");
    span.innerText = "★★★";
    span.style.color = color;
    colorSamplesDiv.appendChild(span);
  });
}

colorsTextArea.addEventListener("input", updateColorSamples);
updateColorSamples();

load3PartsButton.addEventListener("click", () => {
  const colors = getColorsFromGUI();
  function getRequirements(from: HTMLTextAreaElement) {
    const result: ColorRequirements[][] = [];
    from.value.split(endOfLine).forEach((line) => {
      const items = line.split(" ").filter((item) => item != "");
      if (items.length > 0) {
        if (items.length != colors.length) {
          throw new Error(
            `Expecting ${colors.length} requirements, found ${items.length}, "${line}"`
          );
        }
        const thisRowRowColumn: ColorRequirements[] = [];
        items.forEach((item) => {
          const allInARow = item[item.length - 1] == "*";
          if (allInARow) {
            item = item.substring(0, item.length - 1);
          }
          const count = Number.parseInt(item);
          if (count < 0) {
            throw new Error(`invalid count: ${count} in "${line}"`);
          }
          if (count < 2) {
            if (allInARow) {
              throw new Error(
                `all in a row is invalid here: count=${count} in "${line}"`
              );
            }
            thisRowRowColumn.push({ count });
          } else {
            thisRowRowColumn.push({ count, allInARow });
          }
        });
        result.push(thisRowRowColumn);
      }
    });
    return result;
  }
  const puzzleDescription: PuzzleDescription = {
    colors,
    columns: getRequirements(columnsTextArea),
    rows: getRequirements(rowsTextArea),
  };
  requirementsTextArea.value = JSON.stringify(puzzleDescription);
  const puzzle = new Puzzle(puzzleDescription);
  puzzle.checkIntersections();
  showPuzzle(outputTable, puzzle);
});

/**
 * This is the playground where I try to pick colors just to see what will happen.
 * 
 * This is readonly.
 * The idea is that I will have a lot of these at once as I explore different possibilities.
 */
class ProposedRowOrColumn {
  /**
   * False if this configuration broke a rule.
   * True if no obvious rule was broken.
   * This only looks at the colors selected in this row or column and the requirements for this same row or column.
   */
  public readonly valid : boolean;
  /**
   * This maps from an index (0 for the first row or column, 1 for the second, etc.) to a color.
   * If the color for this index is unknown, there is no entry in the table.
   */
  private readonly known : ReadonlyMap<number, number>;
  /**
   * This is the row or column I started with.
   * I keep this mostly for the requirements.
   */
  private readonly base: RowOrColumn;
  /**
   * 
   * @param base I am creating these in small steps.
   * I will start from an actual RowOrColumn.
   * Then I'll add a small number of colors at a time.
   * Because this object is read only, adding colors means creating a new object.
   * Precondition:  Do not start with a ProposedRowOrColumn that is !valid.
   * @param add The items to add.
   * These are organized just like the input to a map constructor.
   * If you name an index-color pair that already exists, it is silently ignored.
   * If you name an index-color pair that conflicts with an existing pair, that's an error.
   * 
   * The default is to add nothing.
   * That is useful when converting a RowOrColumn to a ProposedRowOrColumn.
   * Remember that RowOrColumn is **not** read only, so it can be safer to export a ProposedRowOrColumn.
   * @throws Trying to change an existing color will cause this to throw an exception.
   * Other illegal stuff, like trying to add too many or a single color, will just set the valid flag to false.
   */
  constructor(
    base : ProposedRowOrColumn | RowOrColumn,
    add: [index: number, color: number][] | undefined = undefined
  ) {
    let known : Map<number, number>;
    if (base instanceof ProposedRowOrColumn) {
      if (!base.valid) {
        throw new Error("Cannot build on top of an invalid row or column.")
      }
      this.base = base.base;
      known = new Map(base.known);
    } else {
      this.base = base;
      known = new Map();
      base.cells.forEach((cell,index) => {
        const color = cell.color;
        if (color !== undefined) {
          known.set(index, color);
        }
      });
    }
    this.known = known;
    // It annoys me that this valid check is so slow.
    // For simplicity this always checks everything.
    // It seems like I should be able to do better because I know what's changing!
    // Worst case, I try some tricks when I can, and I always fall back on this if my tricks are inconclusive.
    let valid = true;
    if (add !== undefined) {
      for (const kvp of add) {
        const [index, color] = kvp;
        const previousColor = known.get(index);
        if (previousColor === undefined) {
          known.set(index, color);
        } else if (previousColor != color) {
          valid = false;
          break;
        }
      }
      const allRequirements = this.base.requirements;
      for (let colorToCheck = 0; valid && (colorToCheck < allRequirements.length); colorToCheck++) {
        const requirements = allRequirements[colorToCheck];
        if (requirements.allInARow) {
          let mustEndBefore = -1;
          for (const kvp of known) {
            const [index, colorOfCell] = kvp;
            if (colorOfCell === colorToCheck) {
              if (mustEndBefore == -1) {
                // Found the first of this color.
                mustEndBefore = index + requirements.count;
              }
              if (index >= mustEndBefore) {
                valid = false;
                break;
              }
            }
          }
        } else {
          let stillAllowed = requirements.count;
          for (const kvp of known) {
            const [index, colorOfCell] = kvp;
            if (colorOfCell === colorToCheck) {
              stillAllowed--;
              if (stillAllowed < 0) {
                valid = false;
                break;
              }
            }
          }
        }
        
      }
    }
    this.valid = valid;
  }
  /**
   * Check a color against the other row or column, the one that crosses this one at the
   * specified index.
   * 
   * Note that there are three different places where we store rules.  The row or column
   * we are looking at has its requirements, the cross row or column has similar requirements,
   * and the cell itself can remember that certain colors have been marked as impossible.
   * This function is only checking the cross row or column.
   * @param index The index of the cell in the current row or column.
   * @param color The color to test.  
   * By default this will read the current color out of the given index in this row or column.
   * 
   * Use the default if you've already set this color.
   * Specify a color if you want to check before setting this color.
   * @returns True if the cross row or column allows this color to be placed at this location.
   * False if the given color would break the cross row or column's requirements.
   * @throws If you specify an index that is out of bounds, or if the color is completely unknown,
   * or if the specified color conflicts with an existing color, this will throw an `Error`.
   */
  tryCross(index : number, color? : number) : boolean {
    color ??= this.known.get(index);
    if (color === undefined) {
      throw new Error(`Missing color for index ${index}`);
    }
    const cross = new ProposedRowOrColumn(this.base.cross[this.base.index], [[index, color]]);
    return cross.valid;
  }
}


// Export things to the JavaScript console.
declare global {
  var hcn: any;
}

window.hcn = { CellColor, decodePuzzleDescription, Puzzle, showPuzzle, ProposedRowOrColumn }