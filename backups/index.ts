import type { Page } from "playwright-core";
import { viewProfile } from "./view.js";
import { connectWithProfile } from "./connect.js";
import { likeRecentPost } from "./like.js";

/**
 * Handler signature for all LinkedIn actions.
 * Each action receives a Playwright page and the target profile URL.
 */
export type ActionHandler = (page: Page, profileUrl: string) => Promise<void>;

/**
 * Registry of available actions.
 * To add a new action, import its handler and register it here.
 */
const ACTION_REGISTRY: Record<string, ActionHandler> = {
    view: viewProfile,
    connect: connectWithProfile,
    like: likeRecentPost,
};

export const VALID_ACTIONS = Object.keys(ACTION_REGISTRY);

export function getAction(name: string): ActionHandler | undefined {
    return ACTION_REGISTRY[name.toLowerCase()];
}
