As I was playing _Hungry Cat Nonogram_ I realized I was using a strict set of rules. It seems like the sort of thing that a computer could do better than I could. It seems like it would be more fun to program a solution than to solve things myself.

I am aware that other people have created a solver for this game.

# See it live

At https://tradeideasphilip.github.io/hungry-cat-nonogram-solver/.
It's still pretty rough.
You might want to open the JavaScript console.

Select from one of the known puzzles, or input your own.

Click on a row or column header to direct the program to examine that row or column.
And see the additional buttons near by.

When the program knows the color of a cell, it fills in the entire square with that color.
Otherwise the program draws a circle, and the circle shows all the colors that haven't been ruled out yet.

# See it on YouTube

[![Hungry Cat Nonogram solver on YouTube](https://img.youtube.com/vi/_JQ-LHHsI3c/0.jpg)](http://www.youtube.com/watch?v=_JQ-LHHsI3c "Hungry Cat Nonogram solver on YouTube")

# How it works

When the program first creates a new board, it creates a set of possible colors for each cell.
Initially each cell could be any color.
Over time the program will mark certain colors as impossible.
If a cell could only be one color then the program has figured out that cell.
The set of possible colors should never be empty; the program will throw an exception of that happens.

Note that rows and columns are completely symmetric.

The first test is called `checkIntersections()`.
This is so simple that the program always runs it on every new board.
This was part of a Demo before the other tests were ready and might not have any value any more.
This iterates over each cell and only looks at the initial requirements for the the cell's row and column.
This does not look at any other cells.

The next two tests often go together.
They both focus on a single row or column.
Click on a row or column header to run both tests.
The first does a lot of sub-tests that are all independent.
They can be done in any order.
Finishing one will not affect the others.
The program does this test first for efficiency and simplicity.
The second test involves a lot of speculation.
It can have exponential costs.
It's better to take care of the easy stuff _before_ calling the second test.

`examineCrosses()` examines each cell in a _row_ as follows.
Iterate over all of the colors that are still possible for the cell.
Assume the cell is that color.
Does this new choice violate any of the constraints for the _column_ that contains the cell?
If so, eliminate this color for the set of possible colors for this cell.
When `examineCrosses()` examines a row, the logic is completely analogous.

`examineRowOrColumnBody()` looks at all of the unknown cells in the row or column at once.
It tries every combination of colors that satisfy the rules for this one row or column.
Sometimes this method finds only one possible way to color the remaining cells, and it marks the cells accordingly.
More generally it will find a set of legal ways to lay out the colors in this row or column.
Next the program will look at this complete set of legal alternatives, and it will see if any colors never appear in any cells.
Those are marked in the call as they are found.

Currently the user decides which rows and column to examine and when.
Originally I had considered some strategies for examining the most relevant row or column at any given time.
But `examineCrosses()` and `examineRowOrColumnBody()` are so fast, and each call makes so much progress, I'm just using brute force.

For most of the puzzles this was enough.
However, expert level 305 required more.
`examineRemainingCells()` Looks at all remaining cells at once.
This is the most powerful test, but it can also be the most expensive.
It can suffer exponential growth as the number of remaining cells grows.
Also, this test is missing a lot of the optimizations that are built into `examineCrosses()` and `examineRowOrColumnBody()`.
For best results, examine the individual rows and columns until they stop providing new information, then call `examineRemainingCells()` to finish.
