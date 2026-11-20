/**
 * Spreadsheet-Safe Export Engine (PRD §11, §18 and Amendment J04)
 */

export {
  isDangerousFormulaValue,
  isLegitimateNumber,
  neutralizeCellValue,
  neutralizeFormulas,
  generateCleanedFilename,
  EXPORT_SAFETY_DISCLOSURE,
} from "./safety";

export type { NeutralizeFormulasResult } from "./safety";
