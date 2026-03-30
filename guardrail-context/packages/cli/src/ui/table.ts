/**
 * Table UI components
 * Clean key-value and data tables
 */
import Table from "cli-table3";
import chalk from "chalk";
import { getCaps } from "./terminal.js";

export function kvTable(rows: Array<[string, string]>): string {
  const { color, width } = getCaps();
  const keyWidth = 22;
  const valWidth = Math.min(width - keyWidth - 10, 70);
  
  const t = new Table({
    wordWrap: true,
    colWidths: [keyWidth, valWidth],
    style: { border: [], head: [] },
    chars: {
      top: "", "top-mid": "", "top-left": "", "top-right": "",
      bottom: "", "bottom-mid": "", "bottom-left": "", "bottom-right": "",
      left: "", "left-mid": "", mid: "", "mid-mid": "",
      right: "", "right-mid": "", middle: " │ "
    }
  });

  for (const [k, v] of rows) {
    t.push([color ? chalk.dim(k) : k, v]);
  }
  return t.toString();
}

export function dataTable(headers: string[], rows: string[][]): string {
  const { color, width } = getCaps();
  const colCount = headers.length;
  const colWidth = Math.floor((width - 10) / colCount);
  
  const t = new Table({
    head: headers.map(h => color ? chalk.bold(h) : h),
    wordWrap: true,
    colWidths: Array(colCount).fill(colWidth),
    style: { border: [], head: [] }
  });

  for (const row of rows) {
    t.push(row);
  }
  return t.toString();
}

export function listItems(items: Array<{ label: string; value: string; icon?: string }>): string {
  const { color, unicode } = getCaps();
  const lines: string[] = [];
  
  for (const item of items) {
    const icon = item.icon || (unicode ? "•" : "-");
    const label = color ? chalk.dim(item.label + ":") : item.label + ":";
    lines.push(`  ${icon} ${label} ${item.value}`);
  }
  
  return lines.join("\n");
}
