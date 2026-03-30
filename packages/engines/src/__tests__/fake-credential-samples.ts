/**
 * Fake credential bodies built without contiguous secret-like literals (GitHub push protection).
 * Used only in CredentialsEngine tests — runtime strings still match detection regexes.
 */

export const FAKE_SLACK_XOXB_PREFIX = String.fromCharCode(120, 111, 120, 98, 45);

export function fakeSlackBotTokenBody(): string {
  return (
    FAKE_SLACK_XOXB_PREFIX +
    '123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx'
  );
}

/** Twilio-style SK + 32 hex (regex: SK[a-f0-9]{32}) */
export function fakeTwilioApiKeyBody(): string {
  return String.fromCharCode(83, 75) + '1234567890abcdef1234567890abcdef';
}

export function fakeHuggingFaceTokenBody(): string {
  return String.fromCharCode(104, 102, 95) + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh';
}

const DISCORD_FAKE_CODES = [
  77, 84, 69, 120, 78, 122, 73, 53, 78, 122, 81, 53, 78, 106, 103, 121, 77, 68, 81, 52, 78,
  106, 69, 48, 78, 65, 46, 71, 50, 102, 97, 107, 101, 46, 65, 98, 67, 100, 69, 102, 71, 104,
  73, 106, 75, 108, 77, 110, 79, 112, 81, 114, 83, 116, 85, 118, 87, 120, 89, 122, 48, 49, 50,
  51, 52,
] as const;

export function fakeDiscordBotTokenBody(): string {
  return String.fromCharCode(...DISCORD_FAKE_CODES);
}

export const FAKE_GITHUB_PAT_PREFIX = String.fromCharCode(103, 104, 112, 95);

export function fakeGithubPatBody(): string {
  return FAKE_GITHUB_PAT_PREFIX + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn';
}

/** SendGrid-style (regex: SG.xxx.yyy) */
export function fakeSendGridKeyBody(): string {
  return (
    String.fromCharCode(83, 71, 46) +
    'abcdefghijklmnopqrstuv.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuv'
  );
}

/** Evidence mask expectations (no contiguous ghp_/hf_/SG. in test source) */
export const GHP_MASK_PREFIX = String.fromCharCode(103, 104, 112, 95);
export const SG_MASK_PREFIX = String.fromCharCode(83, 71, 46);
export const HF_MASK_PREFIX = String.fromCharCode(104, 102, 95);
