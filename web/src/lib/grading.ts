export type LetterGrade = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D+" | "D" | "D-" | "F";

const GRADE_SCALE: Array<{ min: number; letter: LetterGrade }> = [
  { min: 90, letter: "A+" },
  { min: 85, letter: "A" },
  { min: 80, letter: "A-" },
  { min: 75, letter: "B+" },
  { min: 70, letter: "B" },
  { min: 65, letter: "B-" },
  { min: 60, letter: "C+" },
  { min: 55, letter: "C" },
  { min: 50, letter: "C-" },
  { min: 45, letter: "D+" },
  { min: 40, letter: "D" },
  { min: 35, letter: "D-" },
];

export function toLetterGrade(scorePercent: number): LetterGrade {
  const safeScore = Number.isFinite(scorePercent) ? scorePercent : 0;
  const hit = GRADE_SCALE.find((g) => safeScore >= g.min);
  return hit?.letter ?? "F";
}
