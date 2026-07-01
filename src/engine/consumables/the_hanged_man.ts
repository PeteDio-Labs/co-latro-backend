import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "the_hanged_man",
    name: "The Hanged Man",
    description: "Destroys up to 2 selected cards",
    kind: "tarot",
    cost: 3,
    needsSelection: {
      min: 1,
      max: 2,
      from: "hand"
    },
    effect: {
      kind: "destroy_selected",
      max: 2
    }
  };

export default def;
