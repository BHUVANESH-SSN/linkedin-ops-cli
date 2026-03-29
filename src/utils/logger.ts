const color = (code: number, text: string): string => `\u001b[${code}m${text}\u001b[0m`;

const blue = (text: string): string => color(34, text);
const green = (text: string): string => color(32, text);
const red = (text: string): string => color(31, text);
const yellow = (text: string): string => color(33, text);
const gray = (text: string): string => color(90, text);

export const logger = {
  info:    (msg: string) => console.log(blue('ℹ'), msg),
  success: (msg: string) => console.log(green('✓'), msg),
  fail:    (msg: string) => console.log(red('✗'), msg),
  running: (msg: string) => console.log(yellow('⏳'), msg),
  divider: ()            => console.log(gray('─'.repeat(50))),
};