export type ActionName = 'view' | 'connect' | 'like';

export interface Config {
  csvPath: string;
  actions: ActionName[];
  delayMs: number;
  dryRun: boolean;
}

export interface ActionResult {
  action: ActionName;
  success: boolean;
  message: string;
}

export interface ProfileResult {
  url: string;
  results: ActionResult[];
}
