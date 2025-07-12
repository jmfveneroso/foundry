export const baseConfig = {
  // Grid.
  GRID_WIDTH: 20,
  GRID_HEIGHT: 30,
  availableWidth: window.innerWidth * 0.95,
  availableHeight: (window.innerHeight - 180) * 0.95,
  EMPTY: 0,
  IRON_MOLTEN: 1,
  STONE: 2, // Represents solid iron for now
  BRASS_MOLTEN: 3,
  BRASS_SOLID: 4,
  PREVIEW_MOLD: 5,
  sandboxMode: false,
  waterMode: true,
  singleParticleCreation: true,
  debugWaterShapes: false,
  viscosity: 0,
  cohesion: 0,
  simulationUpdateInterval: 60,
  pressureThreshold: 5,
  MIN_SPOUT_CLICK_DISTANCE: 4,
  backgroundColor: {
    normal: "#444",
    patternColor: "rgba(128, 128, 128, 0.04)", // Subtle gray for the waves
  },
};

baseConfig.cellSize = Math.floor(
  Math.min(
    baseConfig.availableWidth / baseConfig.GRID_WIDTH,
    baseConfig.availableHeight / baseConfig.GRID_HEIGHT,
    1000 / baseConfig.GRID_HEIGHT
  )
);

// --- Particle Definitions ---
baseConfig.colors = {
  [baseConfig.EMPTY]: "#000000",
  [baseConfig.IRON_MOLTEN]: "#d2b48c", // Re-add for target shape drawing
  [baseConfig.STONE]: "#808080", // Solid Iron color
  [baseConfig.BRASS_SOLID]: "#b5a642", // Solid Brass color
  [baseConfig.PREVIEW_MOLD]: "rgba(100, 150, 255, 0.6)",
};

// Add this new color palette for the molten metal
baseConfig.ironMoltenColors = [
  "#ff4500", // OrangeRed
  "#ff8c00", // DarkOrange
  "#ffac4d", // Tan (Original Sand Color)
  "#ffd700", // Gold
  "#ffff00", // Yellow
];

// Add a new color palette for molten brass
baseConfig.brassMoltenColors = [
  "#f0e68c", // Khaki
  "#ffd700", // Gold
  "#daa520", // GoldenRod
  "#d2b48c", // Tan
  "#f5deb3", // Wheat
];

const mobileOverrides = {};

const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;

export const Config = isMobile
  ? { ...baseConfig, ...mobileOverrides }
  : baseConfig;
