"""Palette and material keys (mirrors docs/ART_BIBLE.md).

Every placed part in assets/layout.json names a material key. The Lune
place builder maps keys to Roblox materials/colours (GREYBOX stand-ins), and
the Blender pipeline maps the same keys to hand-painted pixel-noise texture
tiles, so both renderings of the map agree.

Colours are the sampled reference values (docs/REFERENCE_SPEC.md).
"""

# key: (roblox_material, [light, mid, dark] hex, extra)
MATERIALS = {
    # Surface
    "grass": ("Grass", ["#6FB846", "#5DA33C", "#4A8C30"], {}),
    "grass_dark": ("Grass", ["#4F9A35", "#3F8A2A", "#2F7022"], {}),
    "leaves": ("LeafyGrass", ["#62B53A", "#4A9B26", "#2F7A2A"], {}),
    "leaves_light": ("LeafyGrass", ["#8BD150", "#72BF3E", "#5AA82F"], {}),
    "leaves_dark": ("LeafyGrass", ["#3C8A28", "#2C701F", "#1E5717"], {}),
    "bush": ("LeafyGrass", ["#4E9E30", "#3F8F2A", "#2E7520"], {}),
    "fern": ("Grass", ["#7CCB52", "#5DB33E", "#3E8F2B"], {}),
    "flower_yellow": ("SmoothPlastic", ["#FFF07A", "#F6E05A", "#E0C440"], {}),
    "flower_pink": ("SmoothPlastic", ["#FFB0CC", "#F28AB2", "#D86E98"], {}),
    "flower_white": ("SmoothPlastic", ["#FFFFFF", "#F2F2F2", "#DADADA"], {}),
    "trunk": ("Wood", ["#7A5232", "#5A3B22", "#3E2716"], {}),
    "sand": ("Sand", ["#FDD99B", "#FCD390", "#F0C27E"], {}),
    "sand_dark": ("Sand", ["#E8C285", "#D9AE70", "#C49A5E"], {}),
    "stone_block": ("Slate", ["#A3A4AE", "#8C8C96", "#6D6E78"], {}),
    "water": ("Glass", ["#5FB6DD", "#439EC4", "#2D7590"], {"transparency": 0.25, "reflectance": 0.1}),
    "waterfall": ("Glass", ["#9FF6FF", "#75EFFE", "#44ADE5"], {"transparency": 0.2}),
    "foam": ("SmoothPlastic", ["#FFFFFF", "#F2FBFF", "#DDF4FF"], {"transparency": 0.15}),
    # Island / hole strata
    "dirt": ("Ground", ["#BE6D34", "#8B4D27", "#5C2F1C"], {}),
    "dirt_dark": ("Ground", ["#6E3A20", "#5C2F1C", "#432214"], {}),
    "stone_chunk": ("Slate", ["#8A8E98", "#6D717C", "#555963"], {}),
    "cobble": ("Cobblestone", ["#848182", "#685E5D", "#4A4946"], {}),
    "fossil": ("Limestone", ["#EDE2C4", "#D8C9A3", "#BBA97F"], {}),
    "coal": ("Basalt", ["#3A2931", "#261B24", "#19151F"], {}),
    "iron": ("Metal", ["#A2A7B1", "#8A8F99", "#6E737D"], {}),
    "ore_glint": ("Neon", ["#FFB45E", "#FF9A3C", "#E07C22"], {}),
    "lantern_window": ("Neon", ["#FFD27A", "#FFB347", "#E8922A"], {}),
    "cavern": ("Slate", ["#5F5AAD", "#354073", "#262E59"], {}),
    "cavern_deep": ("Basalt", ["#23264A", "#15182B", "#0E1020"], {}),
    "crystal_cyan": ("Neon", ["#8FFBFF", "#52F6FF", "#10CAF6"], {}),
    "crystal_purple": ("Neon", ["#C77BFF", "#B34EFA", "#7D2CE6"], {}),
    "crystal_magenta": ("Neon", ["#FF7BFF", "#E040FB", "#B020D0"], {}),
    "magma_rock": ("Basalt", ["#B33A3A", "#822936", "#501E34"], {}),
    "magma_floor": ("CrackedLava", ["#9A3030", "#822936", "#5A1F2A"], {}),
    "lava": ("Neon", ["#FF9A3C", "#FE761D", "#E93F1E"], {}),
    "core_gold": ("Foil", ["#FFE08A", "#F7A81B", "#B57A10"], {}),
    "core_glow": ("Neon", ["#FFFFFF", "#FFF4D6", "#FFE1A0"], {}),
    # Built things
    "wood": ("WoodPlanks", ["#9A6A3E", "#6E4A2A", "#4E3420"], {}),
    "wood_dark": ("Wood", ["#4E3420", "#3E2A1C", "#2B1D13"], {}),
    "iron_band": ("Metal", ["#5E636D", "#4A4E57", "#363941"], {}),
    "gate_stone": ("Slate", ["#7990A1", "#4F556F", "#33394F"], {}),
    "gate_dark": ("Slate", ["#33394F", "#203155", "#151D33"], {}),
    "moss": ("Grass", ["#5DAA36", "#4A9B26", "#357A1C"], {}),
    "roof_tile": ("Slate", ["#4A5570", "#374056", "#262D3E"], {}),
    "canvas": ("Fabric", ["#F2E8D0", "#E8DCC0", "#CDBF9F"], {}),
    "canvas_red": ("Fabric", ["#E0584E", "#C9433A", "#A0322B"], {}),
    "board_face": ("SmoothPlastic", ["#2A3048", "#181D2F", "#0E1220"], {}),
    "gold": ("Foil", ["#FFD36B", "#F7A81B", "#C07F12"], {}),
    "metal": ("Metal", ["#6A6F7A", "#4A4E57", "#33363D"], {}),
    "lantern_glass": ("Neon", ["#FFE0A0", "#FFC86B", "#F0A840"], {}),
    "pedestal": ("Slate", ["#817665", "#5C5A50", "#3A3A36"], {}),
    "pedestal_dark": ("Slate", ["#3A3D44", "#282C30", "#1A1C20"], {}),
    "portal_stone": ("Slate", ["#8C93A6", "#6B7287", "#4A5064"], {}),
    "portal_glow": ("Neon", ["#C9FFFF", "#A8FCFC", "#4F97F5"], {"transparency": 0.15}),
    "relic_gold": ("Neon", ["#FFF2A6", "#FBE574", "#F7C64B"], {}),
    "relic_dark": ("Basalt", ["#2A2A30", "#1C1C22", "#121216"], {}),
    # Obbies
    "neon_green": ("Neon", ["#D2FFDF", "#B2FEC9", "#7EF0A2"], {}),
    "platform_green": ("SmoothPlastic", ["#4FB878", "#369C5F", "#257345"], {}),
    "neon_purple": ("Neon", ["#D7C4FF", "#BA99EA", "#9468E0"], {}),
    "neon_blue": ("Neon", ["#9AD6FF", "#5AB8FF", "#2E8CE8"], {}),
    "neon_red": ("Neon", ["#FF7A8E", "#FF3B5C", "#D81E3E"], {}),
    "platform_dark": ("SmoothPlastic", ["#3A3358", "#2A2440", "#1C182C"], {}),
    "sign_green": ("SmoothPlastic", ["#3FAE69", "#2E8F53", "#1F6B3C"], {}),
    "sign_purple": ("SmoothPlastic", ["#4A35A8", "#342388", "#24175E"], {}),
    # Misc
    "invisible": ("SmoothPlastic", ["#FFFFFF", "#FFFFFF", "#FFFFFF"], {"transparency": 1}),
    "marker": ("Neon", ["#FFFFFF", "#FFFFFF", "#FFFFFF"], {"transparency": 1}),
    "mountain": ("Slate", ["#8FC3EA", "#75BCEA", "#5C9FD0"], {}),
    "mountain_snow": ("Snow", ["#FFFFFF", "#EEF6FF", "#D6E8F8"], {}),
    "cloud": ("SmoothPlastic", ["#FFFFFF", "#F4F9FF", "#E2EEFA"], {"transparency": 0.05}),
}


def roblox_material(key):
    return MATERIALS[key][0]


def colours(key):
    return MATERIALS[key][1]


def extra(key):
    return MATERIALS[key][2]
