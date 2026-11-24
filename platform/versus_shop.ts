/// <reference types="genshin-ts" />
import type { ServerExecutionFlowFunctionsByMode } from 'genshin-ts/definitions/nodes';

type ShopFlow = ServerExecutionFlowFunctionsByMode<'beyond'>;

// Catalog and rules inserted by the builder from autopets.data and autopets.rng.
const shopGold = 0n; // AP_SHOP_GOLD
const shopPetCost = 0n; // AP_SHOP_PET_COST
const shopFoodCost = 0n; // AP_SHOP_FOOD_COST
const shopRerollCost = 0n; // AP_SHOP_REROLL_COST
const shopSellGold = 0n; // AP_SHOP_SELL_GOLD
const shopTeamSize = 0n; // AP_SHOP_TEAM_SIZE
const shopPetSlots = 0n; // AP_SHOP_PET_SLOTS
const shopFoodSlots = 0n; // AP_SHOP_FOOD_SLOTS
const shopMaxLevel = 0n; // AP_SHOP_MAX_LEVEL
const shopMaxTier = 0n; // AP_SHOP_MAX_TIER
const shopMergeAttack = 0n; // AP_SHOP_MERGE_ATTACK
const shopMergeHealth = 0n; // AP_SHOP_MERGE_HEALTH
const shopLevelReward = 0n; // AP_SHOP_LEVEL_REWARD
const shopRandomModulus = 0n; // AP_SHOP_RANDOM_MODULUS
const shopRandomMultiplier = 0n; // AP_SHOP_RANDOM_MULTIPLIER
const shopRandomQuotient = 0n; // AP_SHOP_RANDOM_QUOTIENT
const shopRandomRemainder = 0n; // AP_SHOP_RANDOM_REMAINDER

// Packed seat state: round, tier, gold, RNG, next uid, team count, pets, foods,
// five padded (id, uid, attack, health, level, xp) rows, then level-up rewards.
// A negative shelf ID encodes a frozen item. This list belongs to the server.
const shopRoundAt = 0n;
const shopTierAt = 1n;
const shopGoldAt = 2n;
const shopRandomAt = 3n;
const shopUidAt = 4n;
const shopCountAt = 5n;
const shopPetsAt = 6n;
const shopFoodsAt = shopPetsAt + shopPetSlots;
const shopTeamAt = shopFoodsAt + shopFoodSlots;
const shopUnitSize = 6n;
const shopRewardsAt = shopTeamAt + shopTeamSize * shopUnitSize;

function gstsServerPackedRandom(f: ShopFlow, state: bigint[], slot: bigint, span: bigint): bigint {
  const range = shopRandomModulus - 1n;
  const limit = range - range % span;
  let next = f.getCorrespondingValueFromList(state, slot);
  do {
    // Schrage reduction preserves Lua's Park–Miller stream in signed 32 bits.
    next = shopRandomMultiplier * (next % shopRandomQuotient) - shopRandomRemainder * (next / shopRandomQuotient);
    if (next <= 0n) next += shopRandomModulus;
  } while (next > limit);
  f.modifyValueInList(state, slot, next);
  return (next - 1n) % span;
}

function gstsServerShopRefresh(f: ShopFlow, state: bigint[], tier: bigint): void {
  const petLimits = f.assemblyList([0n], 'int'); // AP_SHOP_PET_LIMITS
  const foodLimits = f.assemblyList([0n], 'int'); // AP_SHOP_FOOD_LIMITS
  const petCount = f.getCorrespondingValueFromList(petLimits, tier);
  const foodCount = f.getCorrespondingValueFromList(foodLimits, tier);
  for (let at = shopPetsAt; at < shopTeamAt; at += 1n) {
    const current = f.getCorrespondingValueFromList(state, at);
    if (current >= 0n) {
      let span = petCount;
      if (at >= shopFoodsAt) span = foodCount;
      f.modifyValueInList(state, at, gstsServerPackedRandom(f, state, shopRandomAt, span) + 1n);
    }
  }
}

function gstsServerShopOpen(f: ShopFlow, state: bigint[]): void {
  const round = f.getCorrespondingValueFromList(state, shopRoundAt) + 1n;
  const unlockRounds = f.assemblyList([0n], 'int'); // AP_SHOP_UNLOCK_ROUNDS
  let tier = shopMaxTier;
  while (tier > 1n && round < f.getCorrespondingValueFromList(unlockRounds, tier)) tier -= 1n;
  while (f.getListLength(state) > shopRewardsAt) f.removeValueFromList(state, shopRewardsAt);
  f.modifyValueInList(state, shopRoundAt, round);
  f.modifyValueInList(state, shopTierAt, tier);
  f.modifyValueInList(state, shopGoldAt, shopGold);
  gstsServerShopRefresh(f, state, tier);
}

function gstsServerShopRemove(f: ShopFlow, state: bigint[], from: bigint): void {
  for (let offset = 0n; offset < shopUnitSize; offset += 1n) {
    f.removeValueFromList(state, from);
    f.insertValueIntoList(state, shopRewardsAt - 1n, 0n);
  }
}

function gstsServerShopInsert(f: ShopFlow, state: bigint[], at: bigint, unit: bigint[]): void {
  for (let offset = 0n; offset < shopUnitSize; offset += 1n) {
    f.insertValueIntoList(state, at + offset, f.getCorrespondingValueFromList(unit, offset));
    f.removeValueFromList(state, shopRewardsAt);
  }
}

function gstsServerShopGrow(f: ShopFlow, state: bigint[], to: bigint,
  attack: bigint, health: bigint, xp: bigint): void {
  const thresholds = f.assemblyList([0n], 'int'); // AP_SHOP_LEVEL_THRESHOLDS
  let targetAttack = f.getCorrespondingValueFromList(state, to + 2n);
  let targetHealth = f.getCorrespondingValueFromList(state, to + 3n);
  if (targetAttack < attack) targetAttack = attack;
  if (targetHealth < health) targetHealth = health;
  let level = f.getCorrespondingValueFromList(state, to + 4n);
  let experience = f.getCorrespondingValueFromList(state, to + 5n) + xp + 1n;
  const maximum = f.getCorrespondingValueFromList(thresholds, shopMaxLevel);
  if (experience > maximum) experience = maximum;
  let tier = f.getCorrespondingValueFromList(state, shopTierAt) + shopLevelReward;
  if (tier > shopMaxTier) tier = shopMaxTier;
  const petLimits = f.assemblyList([0n], 'int'); // AP_SHOP_REWARD_PET_LIMITS
  const before = f.getCorrespondingValueFromList(petLimits, tier - 1n);
  const span = f.getCorrespondingValueFromList(petLimits, tier) - before;
  while (level < shopMaxLevel && experience >= f.getCorrespondingValueFromList(thresholds, level + 1n)) {
    level += 1n;
    const code = before + gstsServerPackedRandom(f, state, shopRandomAt, span) + 1n;
    f.insertValueIntoList(state, f.getListLength(state), code);
  }
  f.modifyValueInList(state, to + 2n, targetAttack + shopMergeAttack);
  f.modifyValueInList(state, to + 3n, targetHealth + shopMergeHealth);
  f.modifyValueInList(state, to + 4n, level);
  f.modifyValueInList(state, to + 5n, experience);
}

// The graph checks actor, round, sequence and preparation before calling this.
// Positions use the Lua contract's 1-based indices. An omitted buy target is 0.
// 10 reroll, 11 buy, 12 combine, 13 sell, 14 move, 15 merge, 16 feed, 17 freeze.
// For freeze, to=0 pet / to=1 food and flag=0 toggle / 1 freeze / 2 unfreeze.
// For buy/combine, flag=0 normal stock / flag=1 the level-up reward shelf.
function gstsServerShopApply(f: ShopFlow, state: bigint[], action: bigint,
  from: bigint, to: bigint, flag: bigint): boolean {
  const count = f.getCorrespondingValueFromList(state, shopCountAt);
  const gold = f.getCorrespondingValueFromList(state, shopGoldAt);
  const validFrom = from >= 1n && from <= count;
  const validTo = to >= 1n && to <= count;
  let fromAt = shopTeamAt;
  let toAt = shopTeamAt;
  if (validFrom) fromAt += (from - 1n) * shopUnitSize;
  if (validTo) toAt += (to - 1n) * shopUnitSize;
  let accepted = false;
  if (action === 10n && gold >= shopRerollCost) {
    let canRefresh = false;
    for (let at = shopPetsAt; at < shopTeamAt; at += 1n) {
      if (f.getCorrespondingValueFromList(state, at) >= 0n) canRefresh = true;
    }
    if (canRefresh) {
      gstsServerShopRefresh(f, state, f.getCorrespondingValueFromList(state, shopTierAt));
      f.modifyValueInList(state, shopGoldAt, gold - shopRerollCost);
      accepted = true;
    }
  } else if (action === 11n || action === 12n) {
    let at = shopPetsAt;
    let stock = from >= 1n && from <= shopPetSlots && flag === 0n;
    if (stock) at += from - 1n;
    if (flag === 1n) {
      stock = from >= 1n && from <= f.getListLength(state) - shopRewardsAt;
      if (stock) at = shopRewardsAt + from - 1n;
    }
    if (stock && gold >= shopPetCost) {
      let code = f.getCorrespondingValueFromList(state, at);
      if (code < 0n) code = 0n - code;
      if (code > 0n) {
        const attacks = f.assemblyList([0n], 'int'); // AP_SHOP_PET_ATTACK
        const healths = f.assemblyList([0n], 'int'); // AP_SHOP_PET_HEALTH
        const attack = f.getCorrespondingValueFromList(attacks, code);
        const health = f.getCorrespondingValueFromList(healths, code);
        if (action === 11n && count < shopTeamSize && to >= 0n && to <= count + 1n) {
          let insertion = shopTeamAt + count * shopUnitSize;
          if (to > 0n) insertion = shopTeamAt + (to - 1n) * shopUnitSize;
          const uid = f.getCorrespondingValueFromList(state, shopUidAt);
          const unit = f.assemblyList([code, uid, attack, health, 1n, 0n], 'int');
          gstsServerShopInsert(f, state, insertion, unit);
          f.modifyValueInList(state, shopUidAt, uid + 1n);
          f.modifyValueInList(state, shopCountAt, count + 1n);
          accepted = true;
        } else if (action === 12n && validTo) {
          if (code === f.getCorrespondingValueFromList(state, toAt)
            && f.getCorrespondingValueFromList(state, toAt + 4n) < shopMaxLevel) {
            gstsServerShopGrow(f, state, toAt, attack, health, 0n);
            accepted = true;
          }
        }
        if (accepted) {
          if (flag === 1n) f.removeValueFromList(state, at);
          else f.modifyValueInList(state, at, 0n);
          f.modifyValueInList(state, shopGoldAt, gold - shopPetCost);
        }
      }
    }
  } else if (action === 13n && validTo) {
    const sale = f.initLocalVariable('int', f.getCorrespondingValueFromList(state, toAt + 4n) * shopSellGold);
    gstsServerShopRemove(f, state, toAt);
    f.modifyValueInList(state, shopCountAt, count - 1n);
    f.modifyValueInList(state, shopGoldAt, gold + sale.value);
    accepted = true;
  } else if (action === 14n && validFrom && validTo) {
    if (from !== to) {
      const unit = f.initLocalVariable('int_list', f.assemblyList([
        f.getCorrespondingValueFromList(state, fromAt), f.getCorrespondingValueFromList(state, fromAt + 1n),
        f.getCorrespondingValueFromList(state, fromAt + 2n), f.getCorrespondingValueFromList(state, fromAt + 3n),
        f.getCorrespondingValueFromList(state, fromAt + 4n), f.getCorrespondingValueFromList(state, fromAt + 5n),
      ], 'int'));
      gstsServerShopRemove(f, state, fromAt);
      gstsServerShopInsert(f, state, toAt, unit.value);
    }
    accepted = true;
  } else if (action === 15n && validFrom && validTo && from !== to) {
    if (f.getCorrespondingValueFromList(state, fromAt) === f.getCorrespondingValueFromList(state, toAt)
      && f.getCorrespondingValueFromList(state, toAt + 4n) < shopMaxLevel) {
      gstsServerShopGrow(f, state, toAt,
        f.getCorrespondingValueFromList(state, fromAt + 2n), f.getCorrespondingValueFromList(state, fromAt + 3n),
        f.getCorrespondingValueFromList(state, fromAt + 5n));
      gstsServerShopRemove(f, state, fromAt);
      f.modifyValueInList(state, shopCountAt, count - 1n);
      accepted = true;
    }
  } else if (action === 16n && from >= 1n && from <= shopFoodSlots && validTo && gold >= shopFoodCost) {
    const at = shopFoodsAt + from - 1n;
    let code = f.getCorrespondingValueFromList(state, at);
    if (code < 0n) code = 0n - code;
    if (code > 0n) {
      const attacks = f.assemblyList([0n], 'int'); // AP_SHOP_FOOD_ATTACK
      const healths = f.assemblyList([0n], 'int'); // AP_SHOP_FOOD_HEALTH
      f.modifyValueInList(state, toAt + 2n, f.getCorrespondingValueFromList(state, toAt + 2n)
        + f.getCorrespondingValueFromList(attacks, code));
      f.modifyValueInList(state, toAt + 3n, f.getCorrespondingValueFromList(state, toAt + 3n)
        + f.getCorrespondingValueFromList(healths, code));
      f.modifyValueInList(state, at, 0n);
      f.modifyValueInList(state, shopGoldAt, gold - shopFoodCost);
      accepted = true;
    }
  } else if (action === 17n && flag >= 0n && flag <= 2n) {
    let shelf = shopPetsAt;
    let stock = to === 0n && from >= 1n && from <= shopPetSlots;
    if (to === 1n) {
      shelf = shopFoodsAt;
      stock = from >= 1n && from <= shopFoodSlots;
    }
    if (stock) {
      const at = shelf + from - 1n;
      let code = f.getCorrespondingValueFromList(state, at);
      if (code !== 0n) {
        if (flag === 0n || (flag === 1n && code > 0n) || (flag === 2n && code < 0n)) code = 0n - code;
        f.modifyValueInList(state, at, code);
        accepted = true;
      }
    }
  }
  return accepted;
}
