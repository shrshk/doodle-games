import { z } from "zod";

// One schema for inbuilt, imported and editor boards. Geometry (square -> x,y) is derived from
// `grid`, never stored.
export const BoardSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  name: z.string(),
  author: z.string().default("inbuilt"),
  grid: z.object({
    rows: z.number().int().min(4).max(15),
    cols: z.number().int().min(4).max(15),
    layout: z.enum(["boustrophedon", "spiral", "custom"]).default("boustrophedon"),
    origin: z.enum(["bottom-left", "bottom-right"]).default("bottom-left"),
    // [row, col] per square when layout = custom; row 0 is the top row
    customOrder: z.array(z.tuple([z.number(), z.number()])).optional(),
  }),
  snakes: z.array(z.object({ from: z.number(), to: z.number(), style: z.number().optional() })),
  ladders: z.array(z.object({ from: z.number(), to: z.number() })),
  decorations: z.array(z.object({ square: z.number(), doodle: z.string() })).optional(),
  /** short handwritten words on squares, e.g. Moksha Patam's virtues and vices */
  labels: z.array(z.object({ square: z.number(), text: z.string().max(14) })).optional(),
  theme: z.object({ paper: z.enum(["ruled", "grid", "blank", "kraft"]), accent: z.string().optional() }).optional(),
  source: z.object({ kind: z.enum(["inbuilt", "imported", "editor"]), imageUrl: z.string().optional() }).optional(),
});

export type Board = z.infer<typeof BoardSchema>;
export type BoardInput = z.input<typeof BoardSchema>;
export type Grid = Board["grid"];

export function parseBoard(json: unknown): Board {
  return BoardSchema.parse(json);
}
