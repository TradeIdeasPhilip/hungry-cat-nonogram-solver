import { getById } from "./lib/client-misc.js";
import { count, zip } from "./lib/misc.js";
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
    getRow(index) {
        const result = this.rows[0];
        if (!result) {
            throw new Error(`Unknown row number: ${index}`);
        }
        return new ProposedRowOrColumn(result);
    }
    getColumn(index) {
        const result = this.columns[0];
        if (!result) {
            throw new Error(`Unknown column number: ${index}`);
        }
        return new ProposedRowOrColumn(result);
    }
    constructor(description) {
        this.description = description;
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
                cross: columns,
                index,
                requirements,
            });
        });
    }
    forDisplay() {
        return this.rows.map((row) => row.cells.map((cellColor) => cellColor.colors.map((color) => this.description.colors[color])));
    }
    checkIntersections() {
        return;
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
            if (index == sortedRequirements.length - 1) {
                const toAdd = Array.from(count(0, base.cells.length), (index) => [index, color]);
                toInvestigate.forEach((startFrom) => {
                    const newProposal = new ProposedRowOrColumn(startFrom, toAdd);
                    if (newProposal.valid) {
                        possibilities.push(newProposal);
                    }
                });
            }
            else if (requirements.allInARow) {
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
                        else if (beforeThisColor
                            .colors(index)
                            .every((possibleMatch) => possibleMatch != color)) {
                            return [];
                        }
                        else {
                            return [index];
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
                    find(0, colorsRemainingInInitial[color], []);
                });
            }
        });
        if (possibilities.length == 0) {
            throw new Error("Impossible state.");
        }
        base.cells.forEach((cell, index) => {
            if (!cell.known) {
                const notFoundYet = new Set(count(0, base.requirements.length));
                possibilities.forEach(possibility => {
                    const colors = possibility.colors(index);
                    colors.forEach(color => {
                        notFoundYet.delete(color);
                    });
                });
                notFoundYet.forEach(color => {
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
        cell.style.cursor = (columnIndex % 2) ? "cell" : "crosshair";
    });
    const forDisplay = source.forDisplay();
    for (const [requirements, rowSource, rowIndex] of zip(source.description.columns, forDisplay, count())) {
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
        headerCellWrapper.style.cursor = (rowIndex % 2) ? "cell" : "crosshair";
        rowSource.forEach((cellStyle) => {
            const cell = row.insertCell();
            cell.style.width = "1em";
            const background1 = "conic-gradient(from " +
                Math.random() +
                "turn, " +
                [...cellStyle, ...cellStyle].join(", ") +
                ")";
            const background2 = "linear-gradient(90deg, " +
                [...cellStyle, ...cellStyle].join(", ") +
                ")";
            const rotate = Math.random() * 100;
            const background = "conic-gradient(" +
                cellStyle
                    .map((color, index) => `${color} ${(index / cellStyle.length) * 100}% ${((index + 1) / cellStyle.length) * 100}%`)
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
                    throw new Error(`Expecting ${colors.length} requirements, found ${items.length}, "${line}"`);
                }
                const thisRowRowColumn = [];
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
            for (const kvp of add) {
                const [index, color] = kvp;
                const previousColor = known.get(index);
                if (previousColor === undefined) {
                    known.set(index, color);
                }
                else if (previousColor != color) {
                    valid = false;
                    break;
                }
            }
            const allRequirements = this.base.requirements;
            for (let colorToCheck = 0; valid && colorToCheck < allRequirements.length; colorToCheck++) {
                const requirements = allRequirements[colorToCheck];
                if (requirements.allInARow) {
                    let mustEndBefore = -1;
                    for (const kvp of known) {
                        const [index, colorOfCell] = kvp;
                        if (colorOfCell === colorToCheck) {
                            if (mustEndBefore == -1) {
                                mustEndBefore = index + requirements.count;
                            }
                            if (index >= mustEndBefore) {
                                valid = false;
                                break;
                            }
                        }
                    }
                }
                else {
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
}
window.hcn = {
    CellColor,
    decodePuzzleDescription,
    Puzzle,
    showPuzzle,
    ProposedRowOrColumn,
};
//# sourceMappingURL=index.js.map