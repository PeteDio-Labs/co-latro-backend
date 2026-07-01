import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "the_hermit",
    name: "The Hermit",
    description: "Doubles money (max +$20)",
    kind: "tarot",
    cost: 3,
    effect: {
      kind: "double_money",
      cap: 20
    }
  };

export default def;
