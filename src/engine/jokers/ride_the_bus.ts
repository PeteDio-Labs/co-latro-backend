import type { JokerDef } from "../jokers.ts";

const def: JokerDef = {
    id: "ride_the_bus",
    name: "Ride the Bus",
    description: "+1 Mult per blind cleared",
    cost: 6,
    rarity: "common",
    effect: {
      kind: "scaling_per_blind_mult",
      mult: 1
    }
  };

export default def;
