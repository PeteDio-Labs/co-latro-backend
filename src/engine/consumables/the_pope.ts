import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "the_pope",
    name: "The Pope",
    description: "Enhances 1 selected card to Gold",
    kind: "tarot",
    cost: 3,
    needsSelection: {
      min: 1,
      max: 1,
      from: "hand"
    },
    effect: {
      kind: "enhance_selected",
      enhancement: "gold",
      count: 1
    }
  };

export default def;
