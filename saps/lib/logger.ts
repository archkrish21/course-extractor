import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  redact: {
    paths: [
      "authorization",
      "req.headers.authorization",
      "password",
      "token",
      "grade",
      "midterm_grade",
      "final_grade",
      "midtermGrade",
      "finalGrade",
      "*.password",
      "*.token",
      "*.authorization",
    ],
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
