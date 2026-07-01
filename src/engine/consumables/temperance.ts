import type { ConsumableDef } from "../consumables.ts";

const def: ConsumableDef = {
    id: "temperance",
    name: "Temperance",
    description: "Gives money equal to total sell value of jokers (max $50)",
    kind: "tarot",
    cost: 3,
    effect: {
      kind: "sell_jokers_value",
      cap: 50
    }
  };

export default def;
