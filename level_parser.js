import { getShapeHash } from "./utils.js";
import { Config } from "./config.js";

/**
 * Parses a character map and determines its material type.
 * @param {string[]} lines - An array of strings representing the shape.
 * @returns {Object} An object containing the shape points and the materialType ('iron' or 'brass').
 */
function parseShapeFromLines(lines) {
  const shape = [];
  let materialType = "iron"; // Default to iron
  let materialFound = false;

  lines.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      const char = line[x];
      if (char === "x" || char === "b") {
        shape.push({ x, y });
        // Set the material type based on the first character found
        if (!materialFound) {
          if (char === "b") materialType = "brass";
          materialFound = true;
        }
      }
    }
  });
  return { shape, materialType };
}

/**
 * Parses the entire text content of levels.txt.
 * @param {string} text - The raw text from the file.
 * @returns {Array<Object>} The array of level objects.
 */
function parse(text) {
  const levels = [];
  const levelChunks = text.split("===").filter((chunk) => chunk.trim());

  levelChunks.forEach((chunk) => {
    const lines = chunk.trim().split("\n");
    const levelHeader = lines.shift().trim();
    const levelNum = parseInt(levelHeader.split(":")[1].trim(), 10);

    let currentSection = "";
    const moldLineGroups = [[]];
    const moldPositions = {};
    const targetLines = [];
    const spoutLines = []; // Store lines for the new Spouts section
    let maxHammers = 0;

    for (const line of lines) {
      const processedLine = line.trimEnd();

      if (processedLine.trim().startsWith("// pos:")) {
        try {
          const content = processedLine.split(":")[1].trim();
          const parts = content.split(";")[0].split(",");
          const isStatic = content.includes("static"); // Check for the word 'static'

          const x = parseInt(parts[0].trim(), 10);
          const y = parseInt(parts[1].trim(), 10);
          // Store the position and static flag for the current mold group
          moldPositions[moldLineGroups.length - 1] = { x, y, isStatic };
        } catch (e) {
          console.error("Failed to parse position for level", levelNum);
        }
        continue; // Skip this line as part of a shape
      }

      if (processedLine.trim() === "") {
        if (
          currentSection === "Molds" &&
          moldLineGroups[moldLineGroups.length - 1].length > 0
        ) {
          moldLineGroups.push([]);
        }
        // Also treat blank lines as separators for spouts
        if (
          currentSection === "Spouts" &&
          spoutLines.length > 0 &&
          spoutLines[spoutLines.length - 1].length > 0
        ) {
          spoutLines.push([]);
        }
        continue;
      }

      // Section switching logic
      if (processedLine.startsWith("Molds:")) {
        currentSection = "Molds";
        continue;
      } else if (processedLine.startsWith("Target:")) {
        currentSection = "Target";
        continue;
      } else if (processedLine.startsWith("Spouts:")) {
        currentSection = "Spouts";
        spoutLines.push([]); // Start the first spout group
        continue;
      } else if (processedLine.startsWith("MaxHammers:")) {
        maxHammers = parseInt(processedLine.split(":")[1].trim(), 10);
        continue;
      }

      // Add lines to the correct section
      if (currentSection === "Molds") {
        moldLineGroups[moldLineGroups.length - 1].push(processedLine);
      } else if (currentSection === "Target") {
        targetLines.push(processedLine);
      } else if (currentSection === "Spouts") {
        spoutLines[spoutLines.length - 1].push(processedLine);
      }
    }

    // --- Parse Spouts ---
    const spouts = spoutLines
      .filter((g) => g.length > 0)
      .map((group) => {
        const spout = {
          material: "iron",
          pos: { x: 0, y: 0 },
          flow: 1,
          max: 10,
        };
        group.forEach((line) => {
          const [key, value] = line.split(":").map((s) => s.trim());
          if (key === "Material") spout.material = value;
          if (key === "Flow") spout.flow = parseInt(value, 10);
          if (key === "Max") spout.max = parseInt(value, 10);
          if (key === "Pos") {
            const [x, y] = value.split(",").map((s) => parseInt(s.trim(), 10));
            spout.pos = { x, y };
          }
        });
        return spout;
      });

    // --- Parse Molds ---
    let autoX = 2;
    const PADDING = 1;

    const startingMolds = moldLineGroups
      .map((group, index) => {
        if (group.length === 0) return null;

        const moldData = parseShapeFromLines(group); // Get shape and material
        const customPos = moldPositions[index];
        let startX, startY;
        const isStatic = customPos ? customPos.isStatic : false;

        if (customPos) {
          // Use the position specified in the file
          startX = customPos.x;
          startY = customPos.y;
        } else {
          // Use automatic placement
          const moldWidth =
            group.length > 0 ? Math.max(...group.map((l) => l.length)) : 0;
          startX = autoX;
          startY = 5; // Default Y for auto-placed molds
          autoX += moldWidth + PADDING; // Update the next auto-X position
        }

        return {
          shape: moldData.shape,
          materialType: moldData.materialType, // Store the material
          x: startX,
          y: startY,
          isStatic: isStatic,
        };
      })
      .filter((m) => m !== null);

    const targetData = parseShapeFromLines(targetLines);

    levels.push({
      level: levelNum,
      spouts: spouts, // Add the new array of spout objects
      maxHammers: maxHammers,
      targetShape: targetData.shape,
      targetShapeHash: getShapeHash(targetData.shape),
      targetMaterialType: targetData.materialType,
      startingMolds: startingMolds,
    });
  });

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
