// Names a car is sold under in Colombia when the open sources list it under another name.
// Keyed by "<brand slug>|<model slug>" of the imported model.
export const MODEL_ALIASES: Record<string, string[]> = {
  "byd|atto-3": ["Yuan Plus", "Atto3"],
  "dacia|spring-electric": ["Renault Kwid E-Tech", "Kwid E-Tech"],
  "renault|zoe": ["Zoe E-Tech"],
  "volvo|ex30": ["EX-30"],
};
