import type { ManagedSession } from '../browser/session';
import { likePost } from '../actions/likePost';
import { sendConnect } from '../actions/sendConnect';
import type { ActionName } from '../types';
import { viewProfile } from '../actions/viewProfile';

export interface LikeActionInput {
  command: 'like';
  url: string;
}

export interface ConnectActionInput {
  command: 'connect';
  note?: string;
  profileUrl: string;
}

export interface ViewActionInput {
  command: 'view';
  profileUrl: string;
}

export type ActionInput = LikeActionInput | ConnectActionInput | ViewActionInput;
export type ActionHandler = (session: ManagedSession, input: ActionInput) => Promise<void>;

export const actionRegistry: Record<ActionName, ActionHandler> = {
  like: async (session, input) => {
    if (input.command !== 'like') {
      throw new Error('Invalid input payload for the like action.');
    }

    await likePost(session.page, input.url);
  },
  connect: async (session, input) => {
    if (input.command !== 'connect') {
      throw new Error('Invalid input payload for the connect action.');
    }

    await sendConnect(session.page, input.profileUrl, input.note);
  },
  view: async (session, input) => {
    if (input.command !== 'view') {
      throw new Error('Invalid input payload for the view action.');
    }

    await viewProfile(session.page, input.profileUrl);
  },
};

export const runRegisteredAction = async (
  session: ManagedSession,
  input: ActionInput,
): Promise<void> => {
  await actionRegistry[input.command](session, input);
};
