import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "gift_card",
    name: "Gift Card",
    description: "Earn $1 at end of each hand played",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "economy_per_hand_played",
      dollars: 1
    }
  };

export default def;
