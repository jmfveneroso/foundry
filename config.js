export const baseConfig = {
  // Grid.
  GRID_WIDTH: 20,
  GRID_HEIGHT: 30,
  availableWidth: window.innerWidth * 0.95,
  availableHeight: (window.innerHeight - 180) * 0.95,
  EMPTY: 0,
  SAND: 1,
  STONE: 2,
  sandboxMode: false,
  waterMode: true,
  singleParticleCreation: true,
  debugWaterShapes: false,
  viscosity: 0,
  cohesion: 0,
  simulationUpdateInterval: 60,
  pressureThreshold: 5,
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
  [baseConfig.SAND]: "#d2b48c",
  [baseConfig.STONE]: "#808080",
};

// Add this new color palette for the molten metal
baseConfig.moltenColors = [
  "#ff4500", // OrangeRed
  "#ff8c00", // DarkOrange
  "#ffac4d", // Tan (Original Sand Color)
  "#ffd700", // Gold
  "#ffff00", // Yellow
];

const mobileOverrides = {};

const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;

export const Config = isMobile
  ? { ...baseConfig, ...mobileOverrides }
  : baseConfig;
