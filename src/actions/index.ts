/**
 * ============================================
 * PURPOSE
 * ============================================
 * Central registry for all LinkedIn automation actions.
 *
 * - Maps action names → handler functions
 * - Provides a single source of truth for valid actions
 * - Makes it easy to add new actions (modular design)
 *
 * ============================================
 * INPUT / OUTPUT
 * ============================================
 *
 * getAction(name)
 *   → Input: action name (string)
 *   → Output: corresponding handler function | undefined
 *
 * VALID_ACTIONS
 *   → Output: list of supported action names
 */

import type { Page } from "playwright-core";
import { viewProfile } from "./view.js";
import { connectWithProfile } from "./connect.js";
import { likeRecentPost } from "./like.js";

// ============================================
// ACTION HANDLER TYPE
// ============================================
export type ActionHandler = (
  page: Page,
  profileUrl: string
) => Promise<void>;

// ============================================
// ACTION REGISTRY
// ============================================
const ACTION_REGISTRY: Record<string, ActionHandler> = {
  view: viewProfile,
  connect: connectWithProfile,
  like: likeRecentPost,
};

// ============================================
// EXPORTED HELPERS
// ============================================

// List of valid actions (used for CLI validation)
export const VALID_ACTIONS = Object.keys(ACTION_REGISTRY);

// Get handler for a given action name
export function getAction(
  name: string
): ActionHandler | undefined {
  return ACTION_REGISTRY[name.toLowerCase()];
}