export const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export const humanDelay = async (): Promise<void> => {
  const ms = Math.floor(Math.random() * 2500) + 1500; // 1.5s – 4s
  await delay(ms);
};

export const waitForConfiguredDelay = async (ms: number): Promise<void> => {
  if (ms <= 0) {
    return;
  }

  await delay(ms);
};
