import { getShapeHash } from "./utils.js";
import { Config } from "./config.js";

/**
 * Parses a character map (e.g., ["  x", " xxx"]) into a shape array,
 * respecting leading spaces for coordinates.
 * @param {string[]} lines - An array of strings representing the shape.
 * @returns {Array<Object>} An array of {x, y} points.
 */
function parseShapeFromLines(lines) {
  const shape = [];
  lines.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      if (line[x] === "x") {
        shape.push({ x, y });
      }
    }
  });
  return shape;
}

/**
 * Parses the entire text content of levels.txt.
 * @param {string} text - The raw text from the file.
 * @returns {Array<Object>} The array of level objects.
 */
function parse(text) {
  const levels = [];
  // Split the file into chunks based on the "===" delimiter
  const levelChunks = text.split("===").filter((chunk) => chunk.trim());

  levelChunks.forEach((chunk) => {
    const lines = chunk.trim().split("\n");
    const levelHeader = lines.shift().trim(); // e.g., "LEVEL: 1"
    const levelNum = parseInt(levelHeader.split(":")[1].trim(), 10);

    let currentSection = "";
    const moldLineGroups = [[]]; // An array of arrays, for multiple molds
    const targetLines = [];
    let maxSand = 0;

    for (const line of lines) {
      // Use trimEnd to preserve leading spaces for alignment
      const processedLine = line.trimEnd();

      // Check for an empty line to separate molds
      if (processedLine.trim() === "") {
        if (
          currentSection === "Molds" &&
          moldLineGroups[moldLineGroups.length - 1].length > 0
        ) {
          moldLineGroups.push([]); // Start a new mold group
        }
        continue;
      }

      if (processedLine.startsWith("Molds:")) {
        currentSection = "Molds";
        continue;
      } else if (processedLine.startsWith("Target:")) {
        currentSection = "Target";
        continue;
      } else if (processedLine.startsWith("MaxMoltenMetal:")) {
        currentSection = "";
        maxSand = parseInt(processedLine.split(":")[1].trim(), 10);
        continue;
      }

      if (currentSection === "Molds") {
        // Add line to the current mold group
        moldLineGroups[moldLineGroups.length - 1].push(processedLine);
      } else if (currentSection === "Target") {
        targetLines.push(processedLine);
      }
    }

    // Create the starting molds with simple horizontal placement
    const startingMolds = moldLineGroups
      .map((group, index) => {
        if (group.length === 0) return null;
        const shape = parseShapeFromLines(group);
        // Place molds next to each other with some spacing
        const startX = 4 + index * 6;
        return { shape: shape, x: startX, y: 5 };
      })
      .filter((m) => m !== null); // Remove any empty/invalid groups

    const targetShape = parseShapeFromLines(targetLines);

    levels.push({
      level: levelNum,
      maxSand: maxSand,
      targetShape: targetShape,
      targetShapeHash: getShapeHash(targetShape),
      startingMolds: startingMolds,
    });
  });

  // Add the final "WIN" state to mark the end of the game
  levels.push({ level: "WIN" });
  return levels;
}

/**
 * Asynchronously fetches and parses the levels.txt file.
 * @returns {Promise<Array<Object>>} A promise that resolves to the array of level objects.
 */
export async function loadLevelsFromFile() {
  try {
    const response = await fetch("./levels.txt");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    return parse(text);
  } catch (error) {
    console.error("Could not load or parse levels.txt:", error);
    // Return a default structure or empty array on failure
    return [{ level: "ERROR" }];
  }
}
