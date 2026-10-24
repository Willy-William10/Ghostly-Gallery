const paletteRows = [
  ["catppuccin-mocha","Catppuccin Mocha","#1e1e2e","#313244","#45475a","#cdd6f4","#bac2de","#cba6f7","dark"],
  ["catppuccin-macchiato","Catppuccin Macchiato","#24273a","#363a4f","#494d64","#cad3f5","#b8c0e0","#c6a0f6","dark"],
  ["catppuccin-frappe","Catppuccin Frappé","#303446","#414559","#51576d","#c6d0f5","#b5bfe2","#ca9ee6","dark"],
  ["catppuccin-latte","Catppuccin Latte","#eff1f5","#e6e9ef","#dce0e8","#4c4f69","#5c5f77","#8839ef","light"],
  ["nord","Nord","#2e3440","#3b4252","#434c5e","#eceff4","#d8dee9","#88c0d0","dark"],
  ["one-dark-pro","One Dark Pro","#282c34","#21252b","#3e4451","#abb2bf","#9da5b4","#61afef","dark"],
  ["dracula","Dracula","#282a36","#343746","#44475a","#f8f8f2","#c6c6c2","#bd93f9","dark"],
  ["tokyo-night","Tokyo Night","#1a1b26","#24283b","#2f3549","#c0caf5","#a9b1d6","#7aa2f7","dark"],
  ["tokyo-night-storm","Tokyo Night Storm","#24283b","#292e42","#343a52","#c0caf5","#a9b1d6","#7aa2f7","dark"],
  ["tokyo-night-day","Tokyo Night Day","#e1e2e7","#d5d8e0","#c8ccd7","#3760bf","#61709a","#2e7de9","light"],
  ["gruvbox-dark","Gruvbox Dark","#282828","#3c3836","#504945","#ebdbb2","#d5c4a1","#fabd2f","dark"],
  ["gruvbox-light","Gruvbox Light","#fbf1c7","#ebdbb2","#d5c4a1","#3c3836","#665c54","#d79921","light"],
  ["gruvbox-material-dark","Gruvbox Material Dark","#282828","#32302f","#3c3836","#d4be98","#bdae93","#d8a657","dark"],
  ["gruvbox-material-light","Gruvbox Material Light","#fbf1c7","#f2e5bc","#ebdbb2","#654735","#806044","#d79921","light"],
  ["solarized-dark","Solarized Dark","#002b36","#073642","#0d4751","#839496","#93a1a1","#268bd2","dark"],
  ["solarized-light","Solarized Light","#fdf6e3","#eee8d5","#e0dac8","#586e75","#657b83","#268bd2","light"],
  ["rose-pine","Rosé Pine","#191724","#26233a","#403d52","#e0def4","#908caa","#c4a7e7","dark"],
  ["rose-pine-moon","Rosé Pine Moon","#232136","#2a273f","#393552","#e0def4","#908caa","#c4a7e7","dark"],
  ["rose-pine-dawn","Rosé Pine Dawn","#faf4ed","#f2e9e1","#e4dcd5","#575279","#797593","#907aa9","light"],
  ["kanagawa-wave","Kanagawa Wave","#1f1f28","#2a2a37","#363646","#dcd7ba","#c8c093","#7e9cd8","dark"],
  ["kanagawa-dragon","Kanagawa Dragon","#181616","#282727","#393836","#c5c9c5","#a6a69c","#8ba4b0","dark"],
  ["kanagawa-lotus","Kanagawa Lotus","#f2ecbc","#e7dfad","#d9d09e","#545464","#716e7e","#4d699b","light"],
  ["everforest-dark","Everforest Dark","#2d353b","#343f44","#3d484d","#d3c6aa","#9da9a0","#a7c080","dark"],
  ["everforest-light","Everforest Light","#fdf6e3","#efebd4","#e6e2cc","#5c6a72","#829181","#8da101","light"],
  ["github-dark","GitHub Dark","#0d1117","#161b22","#21262d","#e6edf3","#b1bac4","#2f81f7","dark"],
  ["github-light","GitHub Light","#ffffff","#f6f8fa","#eaeef2","#1f2328","#59636e","#0969da","light"],
  ["monokai-pro","Monokai Pro","#2d2a2e","#363338","#403d41","#fcfcfa","#c1c0c0","#ffd866","dark"],
  ["monokai-classic","Monokai Classic","#272822","#34352f","#3e3f38","#f8f8f2","#cfcfc2","#a6e22e","dark"],
  ["material-palenight","Material Palenight","#292d3e","#32374d","#3e445d","#a6accd","#8f96b3","#c792ea","dark"],
  ["material-ocean","Material Ocean","#0f111a","#1b1e2b","#232738","#8f93a2","#a6accd","#82aaff","dark"],
  ["ayu-dark","Ayu Dark","#0b0e14","#11151c","#1a1f29","#b3b1ad","#828899","#e6b450","dark"],
  ["ayu-mirage","Ayu Mirage","#1f2430","#242936","#2b3140","#cbccc6","#a6a69c","#ffcc66","dark"],
  ["ayu-light","Ayu Light","#fcfcfc","#f3f4f5","#e8e9eb","#5c6166","#787b80","#ff9940","light"],
  ["night-owl","Night Owl","#011627","#09233b","#12304a","#d6deeb","#8fa1b5","#82aaff","dark"],
  ["synthwave-84","Synthwave '84","#262335","#342d4d","#44375d","#f9f4da","#b8a6db","#ff7edb","dark"],
  ["horizon","Horizon","#1c1e26","#232530","#2e303e","#e0e0e0","#b1b1b3","#e95678","dark"],
  ["shades-of-purple","Shades of Purple","#2d2b55","#37346b","#44417d","#ffffff","#b4b0d8","#a599e9","dark"],
  ["cobalt2","Cobalt2","#193549","#224960","#2e5d75","#ffffff","#b6c9d7","#ffc600","dark"],
  ["moonlight-ii","Moonlight II","#222436","#2f334d","#393e5c","#c8d3f5","#a9b8e8","#82aaff","dark"],
  ["nightfox","Nightfox","#192330","#242f3f","#2e3b4e","#cdcecf","#a4a7a8","#719cd6","dark"],
  ["duskfox","Duskfox","#232136","#2d2a45","#393552","#e0def4","#b4a8c8","#ea9a97","dark"],
  ["carbonfox","Carbonfox","#161616","#262626","#353535","#f2f4f8","#b6b9c1","#78a9ff","dark"],
  ["dayfox","Dayfox","#f6f2ee","#eae4df","#ded7d1","#3d2b5a","#776b8b","#c4a7e7","light"],
  ["dawnfox","Dawnfox","#faf4ed","#f2e9e1","#e4dcd5","#575279","#797593","#d7827e","light"],
  ["terafox","Terafox","#152528","#203638","#2d4547","#e6eaea","#a9c0bc","#5ad4e6","dark"],
  ["zenbones","Zenbones","#191919","#282828","#363636","#b4b4b4","#969696","#de6e7c","dark"],
  ["poimandres","Poimandres","#1b1e28","#252b38","#303849","#a6accd","#8f96b3","#5de4c7","dark"],
  ["vitesse-dark","Vitesse Dark","#121212","#202020","#2d2d2d","#dbd7ca","#aaa69c","#4d9375","dark"],
  ["vitesse-light","Vitesse Light","#ffffff","#f2f2f2","#e7e7e7","#393a34","#70716a","#4d9375","light"],
  ["xcode-dark","Xcode Dark","#1f1f24","#29292f","#34343c","#f0f0f0","#b7b7bd","#ff8170","dark"],
  ["xcode-light","Xcode Light","#ffffff","#f4f4f4","#e9e9e9","#262626","#656565","#ad3da4","light"],
  ["andromeda","Andromeda","#23262e","#30343d","#3d424d","#eaf2f1","#b5c2c0","#00e8c6","dark"],
  ["bluloco-dark","Bluloco Dark","#282c34","#343a48","#414b5b","#cddbf5","#a8b8d4","#10b1fe","dark"],
  ["bluloco-light","Bluloco Light","#f7f7f7","#e7e7e7","#dbdbdb","#373b44","#676d79","#275fe4","light"],
  ["outrun-dark","Outrun Dark","#0d0221","#200b3c","#341354","#fff8fb","#c6aecf","#f6019d","dark"],
  ["vscode-dark-plus","Visual Studio Code Dark+","#1e1e1e","#252526","#2d2d30","#d4d4d4","#a0a0a0","#569cd6","dark"],
  ["visual-studio-light","Visual Studio Light","#ffffff","#f3f3f3","#e4e4e4","#333333","#686868","#005fb8","light"],
  ["noctis-uva","Noctis Uva","#2f2a3f","#3a3451","#473f62","#e1e3e4","#b5b2c2","#d590e7","dark"],
  ["noctis-lilac","Noctis Lilac","#fef7ff","#f5eafa","#eadcf0","#4c4a72","#777493","#c792ea","light"],
  ["panda","Panda","#292a2b","#353637","#414344","#e6e6e6","#b7b7b7","#ff75b5","dark"]
];

function rgb(hex) { const value = hex.slice(1); return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16)); }
function asRgba(hex, alpha) { const [r, g, b] = rgb(hex); return `rgba(${r}, ${g}, ${b}, ${alpha})`; }
function luminance(hex) { return rgb(hex).map((channel) => { const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0); }
function adjust(hex, amount) { return `#${rgb(hex).map((value) => Math.round(value + (amount > 0 ? 255 - value : -value) * Math.abs(amount)).toString(16).padStart(2, "0")).join("")}`; }
function hueShift(hex, degrees) {
  const [r, g, b] = rgb(hex).map((value) => value / 255); const max = Math.max(r, g, b); const min = Math.min(r, g, b); const delta = max - min;
  let h = 0; if (delta) { if (max === r) h = ((g - b) / delta) % 6; else if (max === g) h = (b - r) / delta + 2; else h = (r - g) / delta + 4; }
  h = ((h * 60 + degrees) % 360 + 360) % 360; const s = max === 0 ? 0 : delta / max; const v = max;
  const c = v * s; const x = c * (1 - Math.abs((h / 60) % 2 - 1)); const m = v - c; const [rr, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[rr, gg, bb].map((value) => Math.round((value + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export const THEMES = Object.freeze(paletteRows.map(([id, name, bg, surface, raised, text, muted, accent, colorScheme]) => {
  const accentBright = adjust(accent, colorScheme === "light" ? -.13 : .14);
  const cyan = hueShift(accent, 155); const pink = hueShift(accent, 300);
  const theme = { id, name, bg, surface, raised, glass: asRgba(surface, .95), line: asRgba(accent, .33), lineSoft: asRgba(accent, .18), text, muted, subtle: asRgba(muted, .77), accent, accentBright, cyan, pink, wall: accent, phone: cyan, cursor: hueShift(accent, 45), icons: hueShift(accent, 215), favs: pink, colorScheme };
  const onAccent = luminance(accent) > .38 ? "#171717" : "#ffffff";
  theme.tokens = Object.freeze({
    "--bg": bg, "--surface": surface, "--raised": raised, "--glass": theme.glass,
    "--line": theme.line, "--line-soft": theme.lineSoft, "--text": text, "--muted": muted, "--subtle": theme.subtle,
    "--accent": accent, "--accent-bright": accentBright, "--on-accent": onAccent,
    "--cyan": cyan, "--pink": pink, "--wall": theme.wall, "--phone": theme.phone, "--cursor": theme.cursor, "--icons": theme.icons, "--favs": theme.favs,
    "--rail-bg": colorScheme === "light" ? accent : surface, "--rail-ink": colorScheme === "light" ? "rgba(255,255,255,.88)" : muted,
    "--rail-active": colorScheme === "light" ? "#ffffff" : accent, "--rail-active-ink": colorScheme === "light" ? accent : text
  });
  return Object.freeze(theme);
}));

export const THEME_BY_ID = new Map(THEMES.map((theme) => [theme.id, theme]));
export const THEME_ALIASES = Object.freeze({
  light: "catppuccin-latte", dark: "catppuccin-mocha", ghostlight: "catppuccin-mocha", slate: "nord",
  "midnight-oled": "carbonfox", "catppuccin-mocha": "catppuccin-mocha", "catppuccin-latte": "catppuccin-latte",
  "catppuccin-frappe": "catppuccin-frappe", "catppuccin-macchiato": "catppuccin-macchiato", nord: "nord"
});
