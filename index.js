import { getById } from "./lib/client-misc.js";
import { count, sum, zip } from "./lib/misc.js";
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
    get colors() {
        return [...this.possible];
    }
    eliminate(color) {
        this.possible.delete(color);
        if (this.possible.size == 0) {
            throw new Error("wtf");
        }
    }
    limitTo(allowed) {
        [...this.possible].forEach((toCheck) => {
            if (!allowed.has(toCheck)) {
                this.eliminate(toCheck);
            }
        });
    }
    set(color) {
        this.limitTo({
            has(index) {
                return color == index;
            },
        });
    }
    isPossible(color) {
        return this.possible.has(color);
    }
}
function decodePuzzleDescription(possible) {
    const result = JSON.parse(possible);
    result.colors.forEach((color) => {
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
        header.forEach((requirements) => {
            testColorRequirements(requirements);
        });
    });
    result.columns.forEach((header, index) => {
        if (header.length != colorCount) {
            throw new Error(`Expecting ${colorCount} color requirements, found ${header.length}, in column #${index}`);
        }
        header.forEach((requirements) => {
            testColorRequirements(requirements);
        });
    });
    return result;
}
class Puzzle {
    description;
    rows;
    columns;
    getDimensions() {
        return { rowCount: this.rows.length, columnCount: this.columns.length };
    }
    getRow(index) {
        const result = this.rows[index];
        if (!result) {
            throw new Error(`Unknown row number: ${index}`);
        }
        return new ProposedRowOrColumn(result);
    }
    getColumn(index) {
        const result = this.columns[index];
        if (!result) {
            throw new Error(`Unknown column number: ${index}`);
        }
        return new ProposedRowOrColumn(result);
    }
    static verifyDescription(description) {
        const colorCount = description.colors.length;
        function verifyOneDirection(numberOfCrossItems, requirementsForTable, description) {
            requirementsForTable.forEach((requirementsForRowOrColumn, index) => {
                if (colorCount != requirementsForRowOrColumn.length) {
                    throw new Error(`${description} ${index} has ${requirementsForRowOrColumn.length} colors, but the puzzle has ${colorCount} colors.`);
                }
                const requiredCellCount = sum(requirementsForRowOrColumn.map((requirementsForColor) => requirementsForColor.count));
                if (numberOfCrossItems != requiredCellCount) {
                    throw new Error(`${description} ${index} has ${requiredCellCount} cells (when you add up the individual color requirements), but should have ${numberOfCrossItems} cells.`);
                }
            });
        }
        verifyOneDirection(description.columns.length, description.rows, "Row");
        verifyOneDirection(description.rows.length, description.columns, "Column");
        description.columns.length;
    }
    constructor(description) {
        this.description = description;
        Puzzle.verifyDescription(description);
        const colorCount = description.colors.length;
        const cellsRowColumn = [];
        description.rows.forEach((rowRequirements) => {
            const cellsThisRow = [];
            cellsRowColumn.push(cellsThisRow);
            description.columns.forEach((columnRequirements) => {
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
    forDisplay() {
        return this.rows.map((row) => row.cells.map((cellColor) => cellColor.colors.map((color) => this.description.colors[color])));
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
        const allowedInColumn = this.columns.map((column) => allowed(column.requirements));
        this.rows.forEach((row) => {
            const allowedInRow = allowed(row.requirements);
            row.cells.forEach((cellColor, columnIndex) => {
                cellColor.limitTo(allowedInRow);
                cellColor.limitTo(allowedInColumn[columnIndex]);
            });
        });
    }
    examineCrosses(from) {
        from.cells.forEach((cell, index) => {
            if (!cell.known) {
                const crossOriginal = new ProposedRowOrColumn(from.cross[index]);
                cell.colors.forEach((proposedColor) => {
                    const cross = new ProposedRowOrColumn(crossOriginal, [
                        [from.index, proposedColor],
                    ]);
                    if (!cross.valid) {
                        cell.eliminate(proposedColor);
                    }
                });
            }
        });
    }
    examineRowOrColumnBody(base) {
        const colorsRemainingInInitial = base.requirements.map((requirements) => requirements.count);
        for (const cell of base.cells) {
            const color = cell.color;
            if (color !== undefined) {
                colorsRemainingInInitial[color]--;
            }
        }
        const sortedRequirements = base.requirements.flatMap((requirements, color) => {
            if (colorsRemainingInInitial[color] < 1) {
                return [];
            }
            else {
                return [{ color, requirements }];
            }
        });
        sortedRequirements.sort((a, b) => {
            if (a.requirements.allInARow && !b.requirements.allInARow) {
                return -1;
            }
            else if (b.requirements.allInARow && !a.requirements.allInARow) {
                return 1;
            }
            else if (a.requirements.allInARow) {
                return b.requirements.count - a.requirements.count;
            }
            else {
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
                    const toAdd = Array.from(count(start, start + requirements.count), (index) => [index, color]);
                    toInvestigate.forEach((startFrom) => {
                        const newProposal = new ProposedRowOrColumn(startFrom, toAdd);
                        if (newProposal.valid) {
                            possibilities.push(newProposal);
                        }
                    });
                }
            }
            else {
                toInvestigate.forEach((beforeThisColor) => {
                    const available = base.cells.flatMap((_, index) => {
                        if (beforeThisColor.isKnown(index)) {
                            return [];
                        }
                        else if (beforeThisColor.isPossible(index, color)) {
                            return [index];
                        }
                        else {
                            return [];
                        }
                    });
                    function find(cellsAvailableCount, howManyMoreToAdd, toAdd) {
                        if (cellsAvailableCount < howManyMoreToAdd) {
                        }
                        else if (cellsAvailableCount == howManyMoreToAdd) {
                            toAdd = [...available.slice(0, cellsAvailableCount), ...toAdd];
                            const includingThisColor = new ProposedRowOrColumn(beforeThisColor, toAdd.map((index) => [index, color]));
                            if (includingThisColor.valid) {
                                possibilities.push(includingThisColor);
                            }
                        }
                        else if (howManyMoreToAdd == 0) {
                            const includingThisColor = new ProposedRowOrColumn(beforeThisColor, toAdd.map((index) => [index, color]));
                            if (includingThisColor.valid) {
                                possibilities.push(includingThisColor);
                            }
                        }
                        else {
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
    examineRowOrColumn(toExamine) {
        this.examineCrosses(toExamine);
        this.examineRowOrColumnBody(toExamine);
    }
    examineRow(index) {
        this.examineRowOrColumn(this.rows[index]);
    }
    examineColumn(index) {
        this.examineRowOrColumn(this.columns[index]);
    }
    examineRemainingCells() {
        const cellsToFill = [];
        const columnsToTrack = new Set();
        const rowsToTrack = new Set();
        this.rows.forEach((row, rowIndex) => {
            row.cells.forEach((cell, columnIndex) => {
                if (!cell.known) {
                    cellsToFill.push({ rowIndex, columnIndex });
                    columnsToTrack.add(columnIndex);
                    rowsToTrack.add(rowIndex);
                }
            });
        });
        const initialColumns = new Map(Array.from(columnsToTrack, (columnIndex) => [
            columnIndex,
            this.getColumn(columnIndex),
        ]));
        const initialRows = new Map(Array.from(rowsToTrack, (rowIndex) => [rowIndex, this.getRow(rowIndex)]));
        const colorsStillMissing = new Array(this.description.colors.length).fill(0);
        this.rows.forEach((row, rowIndex) => {
            row.requirements.forEach((colorRequirements, color) => {
                const requiredThisTime = colorRequirements.count;
                colorsStillMissing[color] += requiredThisTime;
            });
            row.cells.forEach((cell) => {
                const color = cell.color;
                if (color !== undefined) {
                    colorsStillMissing[color]--;
                }
            });
        });
        const successful = [];
        const tryCell = (cellToFillIndex, colorsStillMissing, rows, columns) => {
            if (cellToFillIndex >= cellsToFill.length) {
                colorsStillMissing.forEach((value) => {
                    if (value) {
                        console.error("colorsStillMissing", colorsStillMissing);
                        throw new Error("wtf");
                    }
                });
                successful.push({ rows, columns });
            }
            else {
                const { rowIndex, columnIndex } = cellsToFill[cellToFillIndex];
                const cell = this.rows[rowIndex].cells[columnIndex];
                cell.colors.forEach((color) => {
                    if (colorsStillMissing[color] < 1) {
                        return;
                    }
                    const row = new ProposedRowOrColumn(rows.get(rowIndex), [
                        [columnIndex, color],
                    ]);
                    if (!row.valid) {
                        return;
                    }
                    const column = new ProposedRowOrColumn(columns.get(columnIndex), [
                        [rowIndex, color],
                    ]);
                    if (!column.valid) {
                        return;
                    }
                    const missingAfterThis = [...colorsStillMissing];
                    missingAfterThis[color]--;
                    const rowsAfterThis = new Map(rows);
                    rowsAfterThis.set(rowIndex, row);
                    const columnsAfterThis = new Map(columns);
                    columnsAfterThis.set(columnIndex, column);
                    tryCell(cellToFillIndex + 1, missingAfterThis, rowsAfterThis, columnsAfterThis);
                });
            }
        };
        tryCell(0, colorsStillMissing, initialRows, initialColumns);
        if (successful.length != 1) {
            throw new Error("wtf");
        }
        const { rows, columns } = successful[0];
        cellsToFill.forEach(({ rowIndex, columnIndex }) => {
            const cell = this.rows[rowIndex].cells[columnIndex];
            const row = rows.get(rowIndex);
            const color = row.color(columnIndex);
            if (color === undefined) {
                throw new Error("wtf");
            }
            cell.set(color);
        });
    }
}
function showPuzzle(destination, source) {
    function showRequirements(rDestination, rSource) {
        for (const [color, requirements] of zip(source.description.colors, rSource)) {
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
    for (const [requirements, rowSource, rowIndex] of zip(source.description.rows, forDisplay, count())) {
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
        rowSource.forEach((cellStyle, columnIndex) => {
            const cell = row.insertCell();
            cell.style.width = "1em";
            const background = "conic-gradient(" +
                cellStyle
                    .map((color, index) => `${color} ${(index / cellStyle.length) * 100}% ${((index + 1) / cellStyle.length) * 100}%`)
                    .join(", ") +
                ")";
            cell.style.background = background;
            if (cellStyle.length > 1) {
                cell.classList.add("encircle");
            }
            cell.addEventListener("click", () => {
                console.log(`hcn.lastShown.rows[${rowIndex}].cells[${columnIndex}]`);
            });
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
    ]) {
        destination.value = source
            .map((row) => row
            .map((requirements) => requirements.count + (requirements.allInARow ? "•" : ""))
            .join(" "))
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
function getColorsFromGUI() {
    const result = [];
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
updateColorSamples();
colorsTextArea.addEventListener("input", updateColorSamples);
updateColorSamples();
load3PartsButton.addEventListener("click", () => {
    const colors = getColorsFromGUI();
    function getRequirements(from) {
        const result = [];
        from.value.split(endOfLine).forEach((line) => {
            const items = line.split(" ").filter((item) => item != "");
            if (items.length > 0) {
                if (items.length != colors.length) {
                    throw new Error(`Expecting ${colors.length} requirements, found ${items.length}: "${line}"`);
                }
                const thisRowRowColumn = [];
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
    const puzzleDescription = {
        colors,
        columns: getRequirements(columnsTextArea),
        rows: getRequirements(rowsTextArea),
    };
    requirementsTextArea.value = JSON.stringify(puzzleDescription);
    const puzzle = new Puzzle(puzzleDescription);
    puzzle.checkIntersections();
    showPuzzle(outputTable, puzzle);
});
const colorEditor = getById("colorEditor", HTMLInputElement);
const colorEditorSample = getById("colorEditorSample", HTMLSpanElement);
const colorEditorValue = getById("colorEditorValue", HTMLInputElement);
colorEditor.addEventListener("input", () => {
    const color = colorEditor.value;
    colorEditorSample.style.color = color;
    colorEditorValue.value = color;
});
colorEditor.dispatchEvent(new Event("input"));
colorEditorValue.addEventListener("input", () => {
    const color = colorEditorValue.value;
    if (/^\#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]$/.test(color)) {
        colorEditorSample.style.color = color;
        colorEditor.value = color;
        colorEditorValue.style.color = "";
    }
    else {
        colorEditorValue.style.color = "red";
    }
});
class ProposedRowOrColumn {
    valid;
    known;
    base;
    constructor(base, add = undefined) {
        let known;
        if (base instanceof ProposedRowOrColumn) {
            if (!base.valid) {
                throw new Error("Cannot build on top of an invalid row or column.");
            }
            this.base = base.base;
            known = new Map(base.known);
        }
        else {
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
            for (const [index, color] of add) {
                if (!this.isPossible(index, color)) {
                    valid = false;
                }
                else {
                    known.set(index, color);
                }
            }
            const allRequirements = this.base.requirements;
            for (let colorToCheck = 0; valid && colorToCheck < allRequirements.length; colorToCheck++) {
                const requirements = allRequirements[colorToCheck];
                if (requirements.allInARow) {
                    let lowestIndex = Number.MAX_SAFE_INTEGER;
                    let highestIndex = Number.MIN_SAFE_INTEGER;
                    let foundAMatch = false;
                    for (const [index, colorOfCell] of known) {
                        if (colorOfCell === colorToCheck) {
                            lowestIndex = Math.min(lowestIndex, index);
                            highestIndex = Math.max(highestIndex, index);
                        }
                    }
                    if (highestIndex - lowestIndex >= requirements.count) {
                        valid = false;
                    }
                }
                else {
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
                            lowestIndex = Math.min(lowestIndex, index);
                            highestIndex = Math.max(highestIndex, index);
                        }
                    }
                    if (stillAllowed == 0 &&
                        requirements.count > 1 &&
                        highestIndex - lowestIndex + 1 == requirements.count) {
                        valid = false;
                    }
                }
            }
        }
        this.valid = valid;
    }
    tryCross(index, color) {
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
    isKnown(index) {
        return this.known.has(index);
    }
    color(index) {
        return this.known.get(index) ?? this.base.cells[index].color;
    }
    colors(index) {
        const proposedColor = this.known.get(index);
        if (proposedColor !== undefined) {
            return [proposedColor];
        }
        else {
            return this.base.cells[index].colors;
        }
    }
    isPossible(index, color) {
        const proposedColor = this.known.get(index);
        if (proposedColor !== undefined) {
            return proposedColor == color;
        }
        else {
            return this.base.cells[index].isPossible(color);
        }
    }
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
loadSamplesButton.addEventListener("click", () => {
    const option = samplesSelect.selectedOptions.item(0);
    if (option) {
        console.log();
        const puzzleDescription = option.puzzleDescription;
        console.log(puzzleDescription.description, puzzleDescription);
        const puzzle = new Puzzle(puzzleDescription);
        puzzle.checkIntersections();
        showPuzzle(outputTable, puzzle);
    }
});
let puzzlesLoaded = false;
try {
    const response = await fetch("./puzzles.json");
    const body = await response.json();
    samplesSelect.innerText = "";
    body.forEach((puzzleDescription) => {
        const option = document.createElement("option");
        option.innerText = puzzleDescription.description;
        option.puzzleDescription = puzzleDescription;
        samplesSelect.appendChild(option);
    });
    if (body.length > 0) {
        loadSamplesButton.disabled = false;
    }
    puzzlesLoaded = true;
}
catch (reason) {
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
const doOneOfEachButton = getById("doOneOfEach", HTMLButtonElement);
doOneOfEachButton.addEventListener("click", () => {
    const lastShown = hcn.lastShown;
    if (lastShown instanceof Puzzle) {
        const { rowCount, columnCount } = lastShown.getDimensions();
        for (let rowNumber = 0; rowNumber < rowCount; rowNumber++) {
            lastShown.examineRow(rowNumber);
        }
        for (let columnNumber = 0; columnNumber < columnCount; columnNumber++) {
            lastShown.examineColumn(columnNumber);
        }
        showPuzzle(outputTable, lastShown);
    }
});
getById("examineRemainingCells", HTMLButtonElement).addEventListener("click", () => {
    const lastShown = hcn.lastShown;
    if (lastShown instanceof Puzzle) {
        lastShown.examineRemainingCells();
        showPuzzle(outputTable, lastShown);
    }
});
//# sourceMappingURL=index.js.map