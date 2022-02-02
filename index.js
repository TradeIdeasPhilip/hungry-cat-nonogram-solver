import { getById } from "./lib/client-misc.js";
class CellColor {
    possible = new Set();
    constructor(colorCount) {
        for (let i = 0; i < colorCount; i++) {
            this.possible.add(i);
        }
    }
    get known() {
        return this.possible.size == 1;
    }
    get color() {
        if (this.possible.size != 1) {
            return undefined;
        }
        for (const colorIndex of this.possible) {
            return colorIndex;
        }
    }
    eliminate(color) {
        this.possible.delete(color);
        if (this.possible.size == 0) {
            throw new Error("wtf");
        }
    }
    limitTo(allowed) {
        [...this.possible].forEach(toCheck => {
            if (!allowed.has(toCheck)) {
                this.eliminate(toCheck);
            }
        });
    }
    isPossible(color) {
        return this.possible.has(color);
    }
}
function decodePuzzleDescription(possible) {
    const result = JSON.parse(possible);
    result.colors.forEach(color => {
        if (typeof color !== "string") {
            throw new Error("colors should be a list of strings.");
        }
    });
    const colorCount = result.colors.length;
    function testColorRequirements(requirements) {
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
        }
        else {
            if (typeof requirements.allInARow !== "boolean") {
                throw new Error("if count ≥ 2, allInARow should be boolean");
            }
        }
    }
    result.rows.forEach((header, index) => {
        if (header.length != colorCount) {
            throw new Error(`Expecting ${colorCount} color requirements, found ${header.length}, in row #${index}`);
        }
        header.forEach(requirements => {
            testColorRequirements(requirements);
        });
    });
    result.columns.forEach((header, index) => {
        if (header.length != colorCount) {
            throw new Error(`Expecting ${colorCount} color requirements, found ${header.length}, in column #${index}`);
        }
        header.forEach(requirements => {
            testColorRequirements(requirements);
        });
    });
    return result;
}
class Puzzle {
    description;
    rows;
    columns;
    constructor(description) {
        this.description = description;
        const colorCount = description.colors.length;
        const cellsRowColumn = [];
        description.rows.forEach(rowRequirements => {
            const cellsThisRow = [];
            cellsRowColumn.push(cellsThisRow);
            description.columns.forEach(columnRequirements => {
                cellsThisRow.push(new CellColor(colorCount));
            });
        });
        const cellsColumnRow = [];
        description.columns.forEach((columnRequirements, columnIndex) => {
            const cellsThisColumn = [];
            cellsColumnRow.push(cellsThisColumn);
            description.rows.forEach((rowRequirements, rowIndex) => {
                const cell = cellsRowColumn[rowIndex][columnIndex];
                cellsThisColumn.push(cell);
            });
        });
        const rows = [];
        const columns = [];
        this.rows = rows;
        this.columns = columns;
        description.rows.forEach((requirements, index) => {
            rows.push({ cells: cellsRowColumn[index], cross: columns, index, requirements });
        });
        description.columns.forEach((requirements, index) => {
            columns.push({ cells: cellsColumnRow[index], cross: columns, index, requirements });
        });
    }
    forDisplay() {
        return this.rows.map(row => row.cells.map(cellColor => {
            const color = cellColor.color;
            if (color === undefined) {
                return undefined;
            }
            else {
                return this.description.colors[color];
            }
        }));
    }
    checkIntersections() {
        function allowed(allRequirements) {
            const result = new Set();
            allRequirements.forEach((colorRequirements, color) => {
                if (colorRequirements.count > 0) {
                    result.add(color);
                }
            });
            return result;
        }
        const allowedInColumn = this.columns.map(column => allowed(column.requirements));
        this.rows.forEach(row => {
            const allowedInRow = allowed(row.requirements);
            row.cells.forEach((cellColor, columnIndex) => {
                cellColor.limitTo(allowedInRow);
                cellColor.limitTo(allowedInColumn[columnIndex]);
            });
        });
    }
}
function showPuzzle(destination, source) {
    destination.innerText = "";
    const forDisplay = source.forDisplay();
    forDisplay.forEach(rowSource => {
        const row = destination.insertRow();
        rowSource.forEach(cellStyle => {
            const cell = row.insertCell();
            cell.style.width = "1em";
            if (cellStyle !== undefined) {
                cell.style.background = cellStyle;
            }
        });
    });
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
load3PartsButton.addEventListener("click", () => {
    const endOfLine = /\r?\n/g;
    const colors = [];
    colorsTextArea.value.split(endOfLine).forEach(line => {
        line = line.trim();
        if (line != "") {
            colors.push(line);
        }
    });
    function getRequirements(from) {
        const result = [];
        from.value.split(endOfLine).forEach(line => {
            const items = line.split(" ").filter(item => item != "");
            if (items.length > 0) {
                if (items.length != colors.length) {
                    throw new Error(`Expecting ${colors.length} requirements, found ${items.length}, "${line}"`);
                }
                const thisRowRowColumn = [];
                items.forEach(item => {
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
                            throw new Error(`all in a row is invalid here: count=${count} in "${line}"`);
                        }
                        thisRowRowColumn.push({ count });
                    }
                    else {
                        thisRowRowColumn.push({ count, allInARow });
                    }
                });
                result.push(thisRowRowColumn);
            }
        });
        return result;
    }
    const puzzleDescription = { colors, columns: getRequirements(columnsTextArea), rows: getRequirements(rowsTextArea) };
    requirementsTextArea.value = JSON.stringify(puzzleDescription);
    const puzzle = new Puzzle(puzzleDescription);
    puzzle.checkIntersections();
    showPuzzle(outputTable, puzzle);
});
//# sourceMappingURL=index.js.map