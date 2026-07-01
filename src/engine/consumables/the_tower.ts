import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "the_tower",
    name: "The Tower",
    description: "Enhances 1 selected card to Stone",
    kind: "tarot",
    cost: 3,
    needsSelection: {
      min: 1,
      max: 1,
      from: "hand"
    },
    effect: {
      kind: "enhance_selected",
      enhancement: "stone",
      count: 1
    }
  };

export default def;
