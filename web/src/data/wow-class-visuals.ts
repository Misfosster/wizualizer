/**
 * Blizzard UI class colors and icon file names for the New APL picker.
 * Icons are served from the public Wowhead CDN (same filenames as in-game).
 */

export interface WowClassVisual {
  slug: string;
  label: string;
  color: string;
  icon: string;
}

export interface WowSpecVisual {
  classSlug: string;
  specSlug: string;
  icon: string;
}

const ZAMIMG_ICON_BASE = "https://wow.zamimg.com/images/wow/icons/medium";

const CLASS_VISUALS: Record<string, WowClassVisual> = {
  warrior: {
    slug: "warrior",
    label: "Warrior",
    color: "#C79C6E",
    icon: "classicon_warrior",
  },
  paladin: {
    slug: "paladin",
    label: "Paladin",
    color: "#F58CBA",
    icon: "classicon_paladin",
  },
  hunter: {
    slug: "hunter",
    label: "Hunter",
    color: "#ABD473",
    icon: "classicon_hunter",
  },
  rogue: {
    slug: "rogue",
    label: "Rogue",
    color: "#FFF569",
    icon: "classicon_rogue",
  },
  priest: {
    slug: "priest",
    label: "Priest",
    color: "#FFFFFF",
    icon: "classicon_priest",
  },
  death_knight: {
    slug: "death_knight",
    label: "Death Knight",
    color: "#C41F3B",
    icon: "classicon_deathknight",
  },
  shaman: {
    slug: "shaman",
    label: "Shaman",
    color: "#0070DE",
    icon: "classicon_shaman",
  },
  mage: {
    slug: "mage",
    label: "Mage",
    color: "#69CCF0",
    icon: "classicon_mage",
  },
  warlock: {
    slug: "warlock",
    label: "Warlock",
    color: "#9482C9",
    icon: "classicon_warlock",
  },
  monk: {
    slug: "monk",
    label: "Monk",
    color: "#00FF96",
    icon: "classicon_monk",
  },
  druid: {
    slug: "druid",
    label: "Druid",
    color: "#FF7D0A",
    icon: "classicon_druid",
  },
  demon_hunter: {
    slug: "demon_hunter",
    label: "Demon Hunter",
    color: "#A330C9",
    icon: "classicon_demonhunter",
  },
  evoker: {
    slug: "evoker",
    label: "Evoker",
    color: "#33937F",
    icon: "classicon_evoker",
  },
};

/** Spec spell/ability icons (medium) keyed by `classSlug/specSlug`. */
const SPEC_ICONS: Record<string, string> = {
  "warrior/arms": "ability_warrior_savageblow",
  "warrior/fury": "ability_warrior_innerrage",
  "warrior/protection": "ability_warrior_defensivestance",
  "paladin/holy": "spell_holy_holybolt",
  "paladin/protection": "spell_holy_devotionaura",
  "paladin/retribution": "spell_holy_auraoflight",
  "hunter/beast_mastery": "ability_hunter_bestialdiscipline",
  "hunter/marksmanship": "ability_hunter_focusedaim",
  "hunter/survival": "ability_hunter_camouflage",
  "rogue/assassination": "ability_rogue_eviscerate",
  "rogue/outlaw": "ability_rogue_waylay",
  "rogue/subtlety": "ability_stealth",
  "priest/discipline": "spell_holy_powerwordshield",
  "priest/holy": "spell_holy_guardianspirit",
  "priest/shadow": "spell_shadow_shadowwordpain",
  "death_knight/blood": "spell_deathknight_bloodpresence",
  "death_knight/frost": "spell_deathknight_frostpresence",
  "death_knight/unholy": "spell_deathknight_unholypresence",
  "shaman/elemental": "spell_nature_lightning",
  "shaman/enhancement": "spell_shaman_improvedstormstrike",
  "shaman/restoration": "spell_nature_magicimmunity",
  "mage/arcane": "spell_holy_magicalsentry",
  "mage/fire": "spell_fire_firebolt02",
  "mage/frost": "spell_frost_frostbolt02",
  "warlock/affliction": "spell_shadow_deathcoil",
  "warlock/demonology": "spell_shadow_metamorphosis",
  "warlock/destruction": "spell_shadow_rainoffire",
  "monk/brewmaster": "spell_monk_brewmaster_spec",
  "monk/mistweaver": "spell_monk_mistweaver_spec",
  "monk/windwalker": "spell_monk_windwalker_spec",
  "druid/balance": "spell_nature_starfall",
  "druid/feral": "ability_druid_catform",
  "druid/guardian": "ability_racial_bearform",
  "druid/restoration": "spell_nature_healingtouch",
  "demon_hunter/havoc": "ability_demonhunter_specdps",
  "demon_hunter/vengeance": "ability_demonhunter_spectank",
  "demon_hunter/devourer": "ability_demonhunter_consumemagic",
  "evoker/devastation": "classicon_evoker_devastation",
  "evoker/preservation": "classicon_evoker_preservation",
  "evoker/augmentation": "classicon_evoker_augmentation",
};

export function getWowClassVisual(classSlug: string): WowClassVisual {
  return (
    CLASS_VISUALS[classSlug] ?? {
      slug: classSlug,
      label: classSlug,
      color: "#9CA3AF",
      icon: "inv_misc_questionmark",
    }
  );
}

export function getWowSpecVisual(
  classSlug: string,
  specSlug: string,
): WowSpecVisual & { color: string } {
  const classVisual = getWowClassVisual(classSlug);
  const key = `${classSlug}/${specSlug}`;
  const icon =
    SPEC_ICONS[key] ??
    classVisual.icon;
  return {
    classSlug,
    specSlug,
    icon,
    color: classVisual.color,
  };
}

export function getWowIconUrl(iconFile: string): string {
  return `${ZAMIMG_ICON_BASE}/${iconFile}.jpg`;
}

/** True when class color is too bright for body text on a light panel. */
export function needsNeutralSpecLabel(hexColor: string): boolean {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) {
    return false;
  }
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.72;
}
