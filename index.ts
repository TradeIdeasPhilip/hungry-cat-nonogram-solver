import { getById } from "./lib/client-misc.js";
import { count, sum, zip } from "./lib/misc.js";

/*
test data

JSON.stringify(hcn.lastShown.rows.map(row => row.cells.map(cell => cell.color)))
'[[0,0,0,0,0,0,0,0,0,0],[0,0,3,3,3,3,3,0,0,0],[0,0,1,1,1,1,1,3,0,3],[0,3,1,2,2,2,2,3,3,3],[0,3,1,2,2,2,2,3,0,3],[0,3,3,3,3,3,3,3,3,0],[0,3,2,3,3,3,1,3,0,0],[0,0,3,3,2,3,3,0,0,0],[0,2,2,3,3,3,2,2,2,0],[0,2,2,2,2,2,2,0,0,0]]'

JSON.stringify(hcn.lastShown.rows.map((row, rowIndex) => row.cells.map((cell, columnIndex) => {return {row: rowIndex, column:columnIndex, color: cell.color}})))
'[[{"row":0,"column":0,"color":0},{"row":0,"column":1,"color":0},{"row":0,"column":2,"color":0},{"row":0,"column":3,"color":0},{"row":0,"column":4,"color":0},{"row":0,"column":5,"color":0},{"row":0,"column":6,"color":0},{"row":0,"column":7,"color":0},{"row":0,"column":8,"color":0},{"row":0,"column":9,"color":0}],[{"row":1,"column":0,"color":0},{"row":1,"column":1,"color":0},{"row":1,"column":2,"color":3},{"row":1,"column":3,"color":3},{"row":1,"column":4,"color":3},{"row":1,"column":5,"color":3},{"row":1,"column":6,"color":3},{"row":1,"column":7,"color":0},{"row":1,"column":8,"color":0},{"row":1,"column":9,"color":0}],[{"row":2,"column":0,"color":0},{"row":2,"column":1,"color":0},{"row":2,"column":2,"color":1},{"row":2,"column":3,"color":1},{"row":2,"column":4,"color":1},{"row":2,"column":5,"color":1},{"row":2,"column":6,"color":1},{"row":2,"column":7,"color":3},{"row":2,"column":8,"color":0},{"row":2,"column":9,"color":3}],[{"row":3,"column":0,"color":0},{"row":3,"column":1,"color":3},{"row":3,"column":2,"color":1},{"row":3,"column":3,"color":2},{"row":3,"column":4,"color":2},{"row":3,"column":5,"color":2},{"row":3,"column":6,"color":2},{"row":3,"column":7,"color":3},{"row":3,"column":8,"color":3},{"row":3,"column":9,"color":3}],[{"row":4,"column":0,"color":0},{"row":4,"column":1,"color":3},{"row":4,"column":2,"color":1},{"row":4,"column":3,"color":2},{"row":4,"column":4,"color":2},{"row":4,"column":5,"color":2},{"row":4,"column":6,"color":2},{"row":4,"column":7,"color":3},{"row":4,"column":8,"color":0},{"row":4,"column":9,"color":3}],[{"row":5,"column":0,"color":0},{"row":5,"column":1,"color":3},{"row":5,"column":2,"color":3},{"row":5,"column":3,"color":3},{"row":5,"column":4,"color":3},{"row":5,"column":5,"color":3},{"row":5,"column":6,"color":3},{"row":5,"column":7,"color":3},{"row":5,"column":8,"color":3},{"row":5,"column":9,"color":0}],[{"row":6,"column":0,"color":0},{"row":6,"column":1,"color":3},{"row":6,"column":2,"color":2},{"row":6,"column":3,"color":3},{"row":6,"column":4,"color":3},{"row":6,"column":5,"color":3},{"row":6,"column":6,"color":1},{"row":6,"column":7,"color":3},{"row":6,"column":8,"color":0},{"row":6,"column":9,"color":0}],[{"row":7,"column":0,"color":0},{"row":7,"column":1,"color":0},{"row":7,"column":2,"color":3},{"row":7,"column":3,"color":3},{"row":7,"column":4,"color":2},{"row":7,"column":5,"color":3},{"row":7,"column":6,"color":3},{"row":7,"column":7,"color":0},{"row":7,"column":8,"color":0},{"row":7,"column":9,"color":0}],[{"row":8,"column":0,"color":0},{"row":8,"column":1,"color":2},{"row":8,"column":2,"color":2},{"row":8,"column":3,"color":3},{"row":8,"column":4,"color":3},{"row":8,"column":5,"color":3},{"row":8,"column":6,"color":2},{"row":8,"column":7,"color":2},{"row":8,"column":8,"color":2},{"row":8,"column":9,"color":0}],[{"row":9,"column":0,"color":0},{"row":9,"column":1,"color":2},{"row":9,"column":2,"color":2},{"row":9,"column":3,"color":2},{"row":9,"column":4,"color":2},{"row":9,"column":5,"color":2},{"row":9,"column":6,"color":2},{"row":9,"column":7,"color":0},{"row":9,"column":8,"color":0},{"row":9,"column":9,"color":0}]]'

This is what the "Medium 182" should look like when it is done.
*/

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
  get colors(): number[] {
    return [...this.possible];
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
  getRow(index: number): ProposedRowOrColumn {
    const result = this.rows[0];
    if (!result) {
      throw new Error(`Unknown row number: ${index}`);
    }
    return new ProposedRowOrColumn(result);
  }
  getColumn(index: number): ProposedRowOrColumn {
    const result = this.columns[0];
    if (!result) {
      throw new Error(`Unknown column number: ${index}`);
    }
    return new ProposedRowOrColumn(result);
  }
  /**
   * Checks if the puzzle description looks good.
   * If all appears well, this returns void.
   * Otherwise it throws an `Error`.
   * @param description The puzzle description to test.
   * @throws If there is a problem, it is reported as an error.
   * Effectively this method _asserts_ that the input is good.
   */
  static verifyDescription(description: PuzzleDescription) {
    const colorCount = description.colors.length;
    /**
     *
     * @param numberOfCrossItems If we are verifying rows, this is the number of columns.
     * @param requirementsForTable The requirements from all rows or all columns.
     * @param description Used only for error messages.
     */
    function verifyOneDirection(
      numberOfCrossItems: number,
      requirementsForTable: readonly (readonly ColorRequirements[])[],
      description: "Row" | "Column"
    ) {
      requirementsForTable.forEach((requirementsForRowOrColumn, index) => {
        if (colorCount != requirementsForRowOrColumn.length) {
          throw new Error(
            `${description} ${index} has ${requirementsForRowOrColumn.length} colors, but the puzzle has ${colorCount} colors.`
          );
        }
        const requiredCellCount = sum(
          requirementsForRowOrColumn.map(
            (requirementsForColor) => requirementsForColor.count
          )
        );
        if (numberOfCrossItems != requiredCellCount) {
          throw new Error(
            `${description} ${index} has ${requiredCellCount} cells (when you add up the individual color requirements), but should have ${numberOfCrossItems} cells.`
          );
        }
      });
    }
    verifyOneDirection(description.columns.length, description.rows, "Row");
    verifyOneDirection(description.rows.length, description.columns, "Column");
    description.columns.length;
  }
  constructor(public readonly description: PuzzleDescription) {
    Puzzle.verifyDescription(description);
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
        cross: rows,
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
  forDisplay(): string[][][] {
    return this.rows.map((row) =>
      row.cells.map((cellColor) =>
        cellColor.colors.map((color) => this.description.colors[color])
      )
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
  private examineCrosses(from: RowOrColumn) {
    from.cells.forEach((cell, index) => {
      if (!cell.known) {
        const crossOriginal = new ProposedRowOrColumn(from.cross[index]);
        cell.colors.forEach((proposedColor) => {
          const cross = new ProposedRowOrColumn(crossOriginal, [
            [from.index, proposedColor],
          ]);
          if (!cross.valid) {
            //console.log({from, cell, index, proposedColor})
            cell.eliminate(proposedColor);
          }
        });
      }
    });
  }
  private examineRowOrColumnBody(base: RowOrColumn) {
    const colorsRemainingInInitial = base.requirements.map(
      (requirements) => requirements.count
    );
    for (const cell of base.cells) {
      const color = cell.color;
      if (color !== undefined) {
        colorsRemainingInInitial[color]--;
      }
    }
    const sortedRequirements = base.requirements.flatMap(
      (requirements, color) => {
        if (colorsRemainingInInitial[color] < 1) {
          return [];
        } else {
          return [{ color, requirements }];
        }
      }
    );
    sortedRequirements.sort((a, b) => {
      // Put the all in a row requirements before the other requirements.
      if (a.requirements.allInARow && !b.requirements.allInARow) {
        return -1;
      } else if (b.requirements.allInARow && !a.requirements.allInARow) {
        return 1;
      } else if (a.requirements.allInARow) {
        // If two requirements are both all in a row, put the one of the largest number of required cells first.
        return b.requirements.count - a.requirements.count;
      } else {
        // If neither requirement is all in a row, don't worry about the order.
        return 0;
      }
    });

    let possibilities = [new ProposedRowOrColumn(base)];

    sortedRequirements.forEach(({ color, requirements }, index) => {
      const toInvestigate = possibilities;
      possibilities = [];
      if (requirements.allInARow) {
        const lastStart = base.cells.length - requirements.count;
        for (let start = 0; start <= lastStart; start++) {
          const toAdd = Array.from(
            count(start, start + requirements.count),
            (index) => [index, color] as const
          );
          toInvestigate.forEach((startFrom) => {
            const newProposal = new ProposedRowOrColumn(startFrom, toAdd);
            if (newProposal.valid) {
              possibilities.push(newProposal);
            }
          });
        }
      } else {
        toInvestigate.forEach((beforeThisColor) => {
          const available = base.cells.flatMap((_, index) => {
            if (beforeThisColor.isKnown(index)) {
              // The color has already been chosen.  There is no reason to look at this.
              return [];
            } else if (beforeThisColor.isPossible(index, color)) {
              // Worth a try!
              return [index];
            } else {
              // The color we are working on will not fit at this index.
              // There is no reason to look at this index again.
              return [];
            }
          });
          /**
           * This will recursively look for ways that we can add the given color to the table.
           * This will try all combinations.
           * All legal possibilities will be added to `possibilities`.
           * @param cellsAvailableCount How many free cells are there where we might add the current color.
           * This will decrease by one for each recursive call to find().
           * We typically examine available[cellsAvailableCount-1] in each step.
           * @param howManyMoreToAdd We need to add this many of the given color to match the requirements.
           * @param toAdd This are the indices of the cells that we already plan to set to the current color.
           * Each recursive call to find() might or might not add one to this number.
           */
          function find(
            cellsAvailableCount: number,
            howManyMoreToAdd: number,
            toAdd: readonly number[]
          ) {
            // TODO new ProposedRowOrColumn() should be smarter.
            // I should be able to create a new ProposedRowOrColumn() every time I select a color.
            // toAdd would go away.
            if (cellsAvailableCount < howManyMoreToAdd) {
              // Nothing is possible.  Give up on this proposal.
            } else if (cellsAvailableCount == howManyMoreToAdd) {
              // No more choices.  Fill in each remaining cell with the current color.
              toAdd = [...available.slice(0, cellsAvailableCount), ...toAdd];
              const includingThisColor = new ProposedRowOrColumn(
                beforeThisColor,
                toAdd.map((index) => [index, color])
              );
              if (includingThisColor.valid) {
                possibilities.push(includingThisColor);
              }
            } else if (howManyMoreToAdd == 0) {
              // No more colors to place.  Try what we have.
              const includingThisColor = new ProposedRowOrColumn(
                beforeThisColor,
                toAdd.map((index) => [index, color])
              );
              if (includingThisColor.valid) {
                possibilities.push(includingThisColor);
              }
            } else {
              // The next cell could go either way.  Let's try both.
              cellsAvailableCount--;
              find(cellsAvailableCount, howManyMoreToAdd, toAdd);
              const index = available[cellsAvailableCount];
              find(cellsAvailableCount, howManyMoreToAdd - 1, [
                index,
                ...toAdd,
              ]);
            }
          }
          find(available.length, colorsRemainingInInitial[color], []);
        });
      }
    });

    if (possibilities.length == 0) {
      throw new Error("Impossible state.");
    }
    // Join all possibilities
    // If all entries in possibilities agree that a certain color is not allowed in a certain cell, then we use that.
    // Nothing else matters.
    // That means that, for each index, take the intersection of the sets of possible colors, take the inverse of that, and mark those colors as impossible.
    // foreach index in the list of cells
    //   create the data structure:  a set initialized to contain all of the colors.  Called notFoundYet
    //   foreach possibility in possibilities
    //     get the .colors associated with this index in this possibility
    //     foreach color in .colors
    //       remove color from notFoundYet
    //   foreach color in notFoundYet
    //     eliminate color.
    // ∎
    base.cells.forEach((cell, index) => {
      if (!cell.known) {
        const notFoundYet = new Set(count(0, base.requirements.length));
        possibilities.forEach((possibility) => {
          const colors = possibility.colors(index);
          colors.forEach((color) => {
            notFoundYet.delete(color);
          });
        });
        notFoundYet.forEach((color) => {
          cell.eliminate(color);
        });
      }
    });
  }
  private examineRowOrColumn(toExamine: RowOrColumn) {
    this.examineCrosses(toExamine);
    this.examineRowOrColumnBody(toExamine);
  }
  public examineRow(index: number) {
    this.examineRowOrColumn(this.rows[index]);
  }
  public examineColumn(index: number) {
    this.examineRowOrColumn(this.columns[index]);
  }
}

function showPuzzle(destination: HTMLTableElement, source: Puzzle) {
  function showRequirements(
    rDestination: HTMLElement,
    rSource: readonly ColorRequirements[]
  ) {
    for (const [color, requirements] of zip(
      source.description.colors,
      rSource
    )) {
      const row = document.createElement("div");
      row.classList.add("headerColorGroup");
      const sample = document.createElement("span");
      sample.innerText = requirements.count ? "★" : "☆";
      sample.style.color = color;
      sample.classList.add("gradientBackground");
      row.appendChild(sample);
      if (requirements.count) {
        row.append(requirements.count.toString());
        if (requirements.allInARow) {
          row.append("•");
        }
      }
      row.append();
      rDestination.appendChild(row);
    }
  }
  destination.innerText = "";
  const topRow = destination.insertRow();
  topRow.insertCell();
  source.description.columns.forEach((columnRequirements, columnIndex) => {
    const cell = topRow.insertCell();
    showRequirements(cell, columnRequirements);
    cell.addEventListener("click", () => {
      source.examineColumn(columnIndex);
      showPuzzle(destination, source);
    });
    cell.style.cursor = columnIndex % 2 ? "cell" : "crosshair";
  });
  const forDisplay = source.forDisplay();
  for (const [requirements, rowSource, rowIndex] of zip(
    source.description.rows,
    forDisplay,
    count()
  )) {
    const row = destination.insertRow();
    const headerCell = row.insertCell();
    const headerCellWrapper = document.createElement("div");
    headerCell.appendChild(headerCellWrapper);
    headerCellWrapper.classList.add("rowHeader");
    showRequirements(headerCellWrapper, requirements);
    headerCellWrapper.addEventListener("click", () => {
      source.examineRow(rowIndex);
      showPuzzle(destination, source);
    });
    headerCellWrapper.style.cursor = rowIndex % 2 ? "cell" : "crosshair";
    rowSource.forEach((cellStyle) => {
      const cell = row.insertCell();
      cell.style.width = "1em";
      const background =
        "conic-gradient(" +
        cellStyle
          .map(
            (color, index) =>
              `${color} ${(index / cellStyle.length) * 100}% ${
                ((index + 1) / cellStyle.length) * 100
              }%`
          )
          .join(", ") +
        ")";
      cell.style.background = background;
      if (cellStyle.length > 1) {
        cell.classList.add("encircle");
      }
    });
  }
  hcn.lastShown = source;
}

const requirementsTextArea = getById("requirements", HTMLTextAreaElement);
const loadButton = getById("load", HTMLButtonElement);
const outputTable = getById("output", HTMLTableElement);

loadButton.addEventListener("click", () => {
  const description = decodePuzzleDescription(requirementsTextArea.value);
  colorsTextArea.value = description.colors.join("\r\n");
  colorsTextArea.rows = description.colors.length;
  updateColorSamples();
  for (const [destination, source] of [
    [columnsTextArea, description.columns],
    [rowsTextArea, description.rows],
  ] as const) {
    destination.value = source
      .map((row) =>
        row
          .map(
            (requirements) =>
              requirements.count + (requirements.allInARow ? "•" : "")
          )
          .join(" ")
      )
      .join("\r\n");
    destination.rows = source.length;
  }
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

function getColorsFromGUI(): string[] {
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
    span.classList.add("gradientBackground");
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
            `Expecting ${colors.length} requirements, found ${items.length}: "${line}"`
          );
        }
        const thisRowRowColumn: ColorRequirements[] = [];
        items.forEach((item) => {
          const lastChar = item[item.length - 1];
          const allInARow = lastChar == "*" || lastChar == "•";
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
  public readonly valid: boolean;
  /**
   * This maps from an index (0 for the first row or column, 1 for the second, etc.) to a color.
   * If the color for this index is unknown, there is no entry in the table.
   */
  private readonly known: ReadonlyMap<number, number>;
  /**
   * This is the row or column I started with.
   * I keep this mostly for the requirements.
   */
  public readonly base: RowOrColumn;
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
   * If you name an index-color pair that conflicts with an existing pair, the result will be !valid.
   *
   * The default is to add nothing.
   * That is useful when converting a RowOrColumn to a ProposedRowOrColumn.
   * Remember that RowOrColumn is **not** read only, so it can be safer to export a ProposedRowOrColumn.
   * @throws If the base is !valid this will throw an error.
   */
  constructor(
    base: ProposedRowOrColumn | RowOrColumn,
    add:
      | readonly (readonly [index: number, color: number])[]
      | undefined = undefined
  ) {
    let known: Map<number, number>;
    if (base instanceof ProposedRowOrColumn) {
      if (!base.valid) {
        throw new Error("Cannot build on top of an invalid row or column.");
      }
      this.base = base.base;
      known = new Map(base.known);
    } else {
      this.base = base;
      known = new Map();
      base.cells.forEach((cell, index) => {
        const color = cell.color;
        if (color !== undefined) {
          known.set(index, color);
        }
      });
    }
    this.known = known;
    let valid = true;
    if (add !== undefined) {
      // It annoys me that this valid check is so slow.
      // For simplicity this always checks everything.
      // It seems like I should be able to do better because I know what's changing!
      // Worst case, I try some tricks when I can, and I always fall back on this if my tricks are inconclusive.
      for (const [index, color] of add) {
        if (!this.isPossible(index, color)) {
          valid = false;
        } else {
          known.set(index, color);
        }
      }
      const allRequirements = this.base.requirements;
      for (
        let colorToCheck = 0;
        valid && colorToCheck < allRequirements.length;
        colorToCheck++
      ) {
        const requirements = allRequirements[colorToCheck];
        if (requirements.allInARow) {
          let lowestIndex = Number.MAX_SAFE_INTEGER;
          let highestIndex = Number.MIN_SAFE_INTEGER;
          let foundAMatch = false;
          for (const [index, colorOfCell] of known) {
            if (colorOfCell === colorToCheck) {
              // Note:  Indices will not always come in order.
              lowestIndex = Math.min(lowestIndex, index);
              highestIndex = Math.max(highestIndex, index);
            }
          }
          if (highestIndex - lowestIndex >= requirements.count) {
            // The are too spread out.
            valid = false;
          }
        } else {
          let stillAllowed = requirements.count;
          let lowestIndex = Number.MAX_SAFE_INTEGER;
          let highestIndex = Number.MIN_SAFE_INTEGER;
          for (const [index, colorOfCell] of known) {
            if (colorOfCell === colorToCheck) {
              stillAllowed--;
              if (stillAllowed < 0) {
                valid = false;
                break;
              }
              // Note:  Indices will not always come in order.
              lowestIndex = Math.min(lowestIndex, index);
              highestIndex = Math.max(highestIndex, index);
            }
          }
          if (
            stillAllowed == 0 &&
            requirements.count > 1 &&
            highestIndex! - lowestIndex! + 1 == requirements.count
          ) {
            // They are all in a row and they should not be.
            // Until all cells of this color have been layed out, we can't be sure of this.

            // TODO if I disable the following line I can't complete the sample, but I completely avoid
            // any errors.  This is a good place to start looking for the bug that I sometimes hit.
            valid = false;
            //console.log("Ignoring colors that are in a row but should not be.")
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
  tryCross(index: number, color?: number): boolean {
    color ??= this.known.get(index);
    if (color === undefined) {
      throw new Error(`Missing color for index ${index}`);
    }
    const cross = new ProposedRowOrColumn(this.base.cross[this.base.index], [
      [index, color],
    ]);
    return cross.valid;
  }
  [Symbol.iterator]() {
    if (!this.valid) {
      throw new Error("wtf");
    }
    return this.known[Symbol.iterator]();
  }
  isKnown(index: number): boolean {
    return this.known.has(index);
  }
  color(index: number): number | unknown {
    return this.known.get(index) ?? this.base.cells[index].color;
  }
  colors(index: number): number[] {
    const proposedColor = this.known.get(index);
    if (proposedColor !== undefined) {
      return [proposedColor];
    } else {
      return this.base.cells[index].colors;
    }
  }
  isPossible(index: number, color: number) {
    const proposedColor = this.known.get(index);
    if (proposedColor !== undefined) {
      return proposedColor == color;
    } else {
      return this.base.cells[index].isPossible(color);
    }
  }
}

// Export things to the JavaScript console.
declare global {
  var hcn: any;
}

window.hcn = {
  CellColor,
  decodePuzzleDescription,
  Puzzle,
  showPuzzle,
  ProposedRowOrColumn,
};

const samplesSelect = getById("samples", HTMLSelectElement);
const loadSamplesButton = getById("loadSamples", HTMLButtonElement);

/**
 * We add some extra fields when we store these in a list, so the user can pick the one he wants.
 */
type PuzzleDescriptionWithMetaData = PuzzleDescription & {
  hint?: string;
  description: string;
};

/**
 * We attach the PuzzleDescription object directly to the <option> element.
 */
type WithDescription = HTMLOptionElement & {
  puzzleDescription: PuzzleDescriptionWithMetaData;
};

loadSamplesButton.addEventListener("click", () => {
  const option = samplesSelect.selectedOptions.item(0);
  if (option) {
    console.log();
    const puzzleDescription = (option as WithDescription).puzzleDescription;
    console.log(puzzleDescription.description, puzzleDescription);
    const puzzle = new Puzzle(puzzleDescription);
    puzzle.checkIntersections();
    showPuzzle(outputTable, puzzle);
    // TODO load this into the other two input sections.
  }
});

let puzzlesLoaded = false;
try {
  const response = await fetch("./puzzles.json");
  const body: PuzzleDescriptionWithMetaData[] = await response.json();
  samplesSelect.innerText = "";
  body.forEach((puzzleDescription) => {
    const option = document.createElement("option");
    option.innerText = puzzleDescription.description;
    (option as WithDescription).puzzleDescription = puzzleDescription;
    samplesSelect.appendChild(option);
  });
  if (body.length > 0) {
    loadSamplesButton.disabled = false;
  }
  puzzlesLoaded = true;
} catch (reason) {
  puzzlesLoaded = false;
  console.log(reason);
}
if (!puzzlesLoaded) {
  samplesSelect.innerText = "";
  const option = document.createElement("option");
  option.innerText = "Failed.";
  samplesSelect.appendChild(option);
  loadSamplesButton.disabled = true;
}
