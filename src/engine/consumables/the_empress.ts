import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "the_empress",
    name: "The Empress",
    description: "Enhances 2 selected cards to Mult",
    kind: "tarot",
    cost: 3,
    needsSelection: {
      min: 2,
      max: 2,
      from: "hand"
    },
    effect: {
      kind: "enhance_selected",
      enhancement: "mult",
      count: 2
    }
  };

export default def;
