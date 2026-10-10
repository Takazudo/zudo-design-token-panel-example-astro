/**
 * Apply-pipeline round-trip, driven through the panel UI.
 *
 * Header trigger → Size tab → edit `--astro-radius` → header Apply → apply
 * modal "Write 1 file" → POST /api/dev/apply (Vite proxy) → zdtp-server →
 * `src/styles/tokens.css` rewritten on disk.
 *
 * The file's original bytes are captured before the test. The assertion is
 * byte-exact: the rewritten file must equal the original with exactly the one
 * declaration line changed. `afterEach` writes the captured bytes back and
 * asserts the restored file equals them byte-for-byte — it runs even when the
 * test fails. Serial mode (plus `workers: 1` in the config) keeps any other
 * spec from observing the file mid-rewrite.
 */

import { readFile, writeFile } from 'node:fs/promises';
import {
  TOKENS_PATH,
  clickHeaderAction,
  expect,
  openViaHeader,
  rootTokenValue,
  setLengthToken,
  test,
} from './support';

test.describe.configure({ mode: 'serial' });

const TARGET_VAR = '--astro-radius';
const ORIGINAL_LINE = `  ${TARGET_VAR}: 0.5rem;`;
const APPLIED_LINE = `  ${TARGET_VAR}: 1.25rem;`;

let originalBytes: Buffer;

test.beforeAll(async () => {
  originalBytes = await readFile(TOKENS_PATH);
});

test.afterEach(async () => {
  const current = await readFile(TOKENS_PATH);
  if (!current.equals(originalBytes)) {
    await writeFile(TOKENS_PATH, originalBytes);
  }
  const restored = await readFile(TOKENS_PATH);
  expect(restored.equals(originalBytes), 'tokens.css restored byte-for-byte').toBe(true);
});

test('panel Apply rewrites tokens.css on disk with exactly the edited declaration', async ({
  page,
}) => {
  const originalText = originalBytes.toString('utf8');
  expect(originalText.split(ORIGINAL_LINE)).toHaveLength(2);
  const expectedBytes = Buffer.from(originalText.replace(ORIGINAL_LINE, APPLIED_LINE), 'utf8');

  await page.goto('/');
  await openViaHeader(page);
  await setLengthToken(page, /^size$/i, TARGET_VAR, '1.25');
  expect(await rootTokenValue(page, TARGET_VAR)).toBe('1.25rem');

  await clickHeaderAction(page, 'apply');
  const writeButton = page.getByRole('button', { name: /^Write 1 file \(1 token\)$/ });
  await expect(writeButton).toBeVisible();

  // Opening the modal already POSTs a dry-run preview; wait for the real write.
  const writeResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/dev/apply') &&
      response.request().method() === 'POST' &&
      (response.request().postDataJSON() as { dryRun?: boolean }).dryRun !== true,
  );
  await writeButton.click();
  const response = await writeResponse;
  expect(response.status()).toBe(200);
  // Success envelope: PORTABLE-CONTRACT §5.1 "Response 200 (success)".
  const body = (await response.json()) as {
    ok: boolean;
    updated: Array<{ file: string; changed: string[] }>;
  };
  expect(body.ok).toBe(true);
  expect(body.updated.map(({ file, changed }) => ({ file, changed }))).toEqual([
    { file: 'src/styles/tokens.css', changed: [TARGET_VAR] },
  ]);
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();

  await expect
    .poll(async () => (await readFile(TOKENS_PATH)).equals(expectedBytes), {
      message: 'tokens.css equals the original with only the edited line changed',
    })
    .toBe(true);
});
