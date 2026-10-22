import { memo } from "react";
import {
  Bunting,
  Butterfly,
  Cloud,
  CoffeeStain,
  Dandelion,
  Flower,
  GrassTuft,
  HillHouse,
  Ladybug,
  MiniMushroom,
  Potato,
  Rainbow,
  Snail,
  Sun,
  Whale,
} from "@snakes-doodle/ui-doodle";
import type { Critter, SheetLayout } from "../board/layout";

const CRITTERS: Record<Critter, () => JSX.Element> = {
  ladybug: () => <Ladybug />,
  snail: () => <Snail />,
  butterfly: () => <Butterfly />,
  dandelion: () => <Dandelion />,
  "coffee-stain": () => <CoffeeStain />,
  "hill-house": () => <HillHouse />,
};

const at = (x: number, y: number, s = 1) => `translate(${x} ${y}) scale(${s})`;

/** Ambient doodles around the board. The sun grins on ladders; the potatoes wake on snakes. */
export const Margins = memo(function Margins({
  layout,
  sunGrin,
  potatoesAwake,
}: {
  layout: SheetLayout;
  sunGrin: boolean;
  potatoesAwake: boolean;
}) {
  return (
    <g aria-hidden="true">
      {layout.critters.map((c, i) => (
        <g key={`${c.kind}-${i}`} transform={at(c.x, c.y, c.s)}>
          {CRITTERS[c.kind]()}
        </g>
      ))}
      {layout.bunting && (
        <g transform={at(layout.bunting.x, layout.bunting.y)}>
          <Bunting width={layout.bunting.width} />
        </g>
      )}
      {layout.sun && (
        <g transform={at(layout.sun.x, layout.sun.y, layout.sun.s)}>
          <Sun grin={sunGrin} />
        </g>
      )}
      {layout.clouds.map((c, i) => (
        <g key={i} transform={at(c.x, c.y, c.s)}>
          <Cloud />
        </g>
      ))}
      {layout.rainbow && (
        <g transform={at(layout.rainbow.x, layout.rainbow.y, layout.rainbow.s)}>
          <Rainbow />
        </g>
      )}
      {layout.whale && (
        <g transform={at(layout.whale.x, layout.whale.y, layout.whale.s)}>
          <Whale />
        </g>
      )}
      {layout.potatoes.map((p, i) => (
        <g key={i} transform={at(p.x, p.y, p.s)}>
          <Potato awake={potatoesAwake} />
        </g>
      ))}
      {layout.grass.map((p, i) => (
        <g key={i} transform={at(p.x, p.y)}>
          <GrassTuft />
        </g>
      ))}
      {layout.flowers.map((p, i) => (
        <g key={i} transform={at(p.x, p.y)}>
          <Flower color={i % 2 ? "#D9534A" : "#6C8FD0"} />
        </g>
      ))}
      {layout.mushrooms.map((p, i) => (
        <g key={i} transform={at(p.x, p.y)}>
          <MiniMushroom />
        </g>
      ))}
    </g>
  );
});
