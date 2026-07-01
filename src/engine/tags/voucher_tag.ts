import type { TagDef } from "../tags.ts";

const def: TagDef = {
    id: "voucher_tag",
    name: "Voucher Tag",
    description: "Adds a Voucher to the next shop",
    trigger: "on_shop_enter",
    effect: {
      kind: "free_voucher"
    }
  };

export default def;
