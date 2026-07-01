import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "the_chariot",
    name: "The Chariot",
    description: "Enhances 1 selected card to Steel",
    kind: "tarot",
    cost: 3,
    needsSelection: {
      min: 1,
      max: 1,
      from: "hand"
    },
    effect: {
      kind: "enhance_selected",
      enhancement: "steel",
      count: 1
    }
  };

export default def;
