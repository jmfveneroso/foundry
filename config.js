export const baseConfig = {
  // Grid.
  GRID_WIDTH: 30,
  GRID_HEIGHT: 40,
  availableWidth: window.innerWidth * 0.95,
  availableHeight: (window.innerHeight - 180) * 0.95,
  EMPTY: 0,
  SAND: 1,
  STONE: 2,
  waterMode: true,
  singleParticleCreation: true,
  debugWaterShapes: true,
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

const mobileOverrides = {};

const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;

export const Config = isMobile
  ? { ...baseConfig, ...mobileOverrides }
  : baseConfig;
