import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "walkie_talkie",
    name: "Walkie Talkie",
    description: "+10 Chips and +4 Mult",
    cost: 4,
    rarity: "common",
    effect: {
      kind: "flat_chips_and_mult",
      chips: 10,
      mult: 4
    }
  };

export default def;
