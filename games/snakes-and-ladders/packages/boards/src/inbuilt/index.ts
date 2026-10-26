import { parseBoard, type Board } from "../schema";
import bigSheetJson from "./big-sheet.json";
import classic100Json from "./classic-100.json";
import gardenPartyJson from "./garden-party.json";
import ladderClimbJson from "./ladder-climb.json";
import mokshaPatamJson from "./moksha-patam.json";
import mountainPathJson from "./mountain-path.json";
import pocketSheetJson from "./pocket-sheet.json";
import quickDoodleJson from "./quick-doodle.json";
import snakePitJson from "./snake-pit.json";
import spiralNotebookJson from "./spiral-notebook.json";

export const classic100: Board = parseBoard(classic100Json);

/** Picker order: the default first, then roughly shortest to longest game. */
export const inbuiltBoards: readonly Board[] = [
  classic100,
  parseBoard(quickDoodleJson),
  parseBoard(pocketSheetJson),
  parseBoard(ladderClimbJson),
  parseBoard(spiralNotebookJson),
  parseBoard(mokshaPatamJson),
  parseBoard(gardenPartyJson),
  parseBoard(mountainPathJson),
  parseBoard(snakePitJson),
  parseBoard(bigSheetJson),
];

/** One line for the picker under each board's name. */
export const boardBlurbs: Record<string, string> = {
  "classic-100": "the one everyone knows",
  "quick-doodle": "tiny, done in five minutes",
  "pocket-sheet": "small and quick, on brown paper",
  "garden-party": "lots of little ups and downs",
  "mountain-path": "a few huge climbs, a few long falls",
  "ladder-climb": "lots of ladders, short games",
  "spiral-notebook": "the path curls into the middle",
  "moksha-patam": "the old Indian game of virtues and vices",
  "snake-pit": "watch out near the top",
  "big-sheet": "144 squares for long games",
};
