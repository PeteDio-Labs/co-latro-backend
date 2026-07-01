import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "the_fool",
    name: "The Fool",
    description: "Creates a copy of the last consumable used (Tarot or Planet).",
    kind: "tarot",
    cost: 3,
    effect: {
      kind: "copy_last_consumable"
    }
  };

export default def;
