import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "frugal_joker",
    name: "Frugal Joker",
    description: "+50 Chips per discard used this blind",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "on_discard_chips",
      chips: 50
    }
  };

export default def;
