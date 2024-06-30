
export function removeChars(text: string): string {
  let newText = "";
  const charsToRemove = "-:";
  for (const char of text) {
    if (!charsToRemove.includes(char)) {
      newText += char;
    }
  }
  return newText;
}
 

