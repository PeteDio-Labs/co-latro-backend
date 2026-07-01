import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "banner",
    name: "Banner",
    description: "+30 Chips per remaining discard",
    cost: 5,
    rarity: "common",
    effect: {
      kind: "per_remaining_discard_chips",
      chips: 30
    }
  };

export default def;
