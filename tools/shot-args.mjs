// Argument parsing for shot.mjs, kept separate so it can be tested without a browser
// (`npm test` in tools/).

/**
 * `--fill <selector>=<text>` → { selector, text }. Splits on the last '=', so selectors that
 * contain one keep it: `input[type=search]=psalm`, `id=ff-pw=footprints`. The text can't
 * contain '='; an empty text (`#q=`) clears the field. A last '=' inside an unclosed `[…]`
 * (`input[type=search]`) means the text was left off.
 */
export function parseFill(arg) {
  const i = arg.lastIndexOf('=');
  const selector = arg.slice(0, i);
  const count = ch => selector.split(ch).length - 1;
  if (i <= 0 || count('[') > count(']')) throw new Error(`--fill needs <selector>=<text>, got "${arg}"`);
  return { selector, text: arg.slice(i + 1) };
}
