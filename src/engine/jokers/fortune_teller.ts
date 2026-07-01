import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "fortune_teller",
    name: "Fortune Teller",
    description: "+1 Mult per blind cleared",
    cost: 6,
    rarity: "uncommon",
    effect: {
      kind: "scaling_per_blind_mult",
      mult: 1
    }
  };

export default def;
