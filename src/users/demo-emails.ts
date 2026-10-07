/**
 * Backend-only contact emails for the demo accounts (the same ones listed under
 * "Set ...'s email" in requests.http). They are applied only to accounts that
 * have no email yet, so POST /auth/update-email always wins and nothing already
 * stored is ever overwritten. The auto-split proposal email is sent to these.
 */
export const DEMO_ACCOUNT_EMAILS: Record<string, string> = {
  '3005335181': 'erioluwaolateju@gmail.com',
  '3005335182': 'ezebibian4@gmail.com',
  '3005335183': 'debelezefavour@gmail.com',
  '3005335184': 'opelumifayomi@gmail.com',
};
