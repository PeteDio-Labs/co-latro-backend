import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "the_magician",
    name: "The Magician",
    description: "Enhances 2 selected cards to Lucky",
    kind: "tarot",
    cost: 3,
    needsSelection: {
      min: 2,
      max: 2,
      from: "hand"
    },
    effect: {
      kind: "enhance_selected",
      enhancement: "lucky",
      count: 2
    }
  };

export default def;
