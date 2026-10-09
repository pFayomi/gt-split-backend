/**
 * Contact phone numbers for the demo accounts. The app splits by phone, so
 * these accounts need a number on file or other users can never surface a
 * split to them. Like DEMO_ACCOUNT_EMAILS, these are only applied to accounts
 * that have no phone yet, so POST /auth/update-phone always wins and nothing
 * already stored is ever overwritten.
 */
export const DEMO_ACCOUNT_PHONES: Record<string, string> = {
  '3005335181': '+2349033221911',
  '3005335182': '+2348153535253',
  '3005335183': '+2348129238757',
  '3005335184': '+2349152650555',
};
