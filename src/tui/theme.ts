export interface Theme {
  accent: string;
  dim: string;
  error: string;
  reset: string;
  success: string;
  warning: string;
}

const RESET = "\u001B[0m";

export const THEMES: Record<string, Theme> = {
  amber: {
    accent: "\u001B[38;5;214m",
    dim: "\u001B[38;5;245m",
    error: "\u001B[38;5;203m",
    reset: RESET,
    success: "\u001B[38;5;114m",
    warning: "\u001B[38;5;221m"
  },
  ice: {
    accent: "\u001B[38;5;81m",
    dim: "\u001B[38;5;245m",
    error: "\u001B[38;5;203m",
    reset: RESET,
    success: "\u001B[38;5;115m",
    warning: "\u001B[38;5;222m"
  },
  matrix: {
    accent: "\u001B[38;5;46m",
    dim: "\u001B[38;5;244m",
    error: "\u001B[38;5;196m",
    reset: RESET,
    success: "\u001B[38;5;46m",
    warning: "\u001B[38;5;190m"
  }
};
