export const palette = {
  paper: "#EEEAE0",
  ink: "#3B2F2A",
  hatchGreen: "#8DB27A",
  crayonRed: "#D9534A",
  crayonBlue: "#3E3F9E",
  markerOrange: "#E3A84B",
  pencilYellow: "#E9C24A",
  blush: "#F28B9A",
  pencilBrown: "#8A5A35",
  leaf: "#6FA05A",
} as const;

export type TokenColor = "red" | "yellow" | "orange" | "indigo";

export const TOKEN_COLORS: readonly TokenColor[] = ["red", "yellow", "orange", "indigo"];

export const tokenInk: Record<TokenColor, string> = {
  red: palette.crayonRed,
  yellow: "#C99A22",
  orange: "#D9702B",
  indigo: palette.crayonBlue,
};

export const characterName: Record<TokenColor, string> = {
  red: "mushroom",
  yellow: "bee",
  orange: "owl",
  indigo: "blob",
};
