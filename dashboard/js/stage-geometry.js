// Keep the 1280px design width used by touch-coordinate calculations.
// Taller screens gain vertical layout room instead of centering a floating canvas.
export function stageGeometry(width, height) {
  const scale = Math.min(width / 1280, height / 800);
  return { scale, height: height / scale };
}
