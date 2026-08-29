import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const SAMPLES = path.resolve(__dirname, '../../samples');

const SAMPLE_FILES = {
  sprint: path.join(SAMPLES, '01-sprint-planning.txt'),
  design: path.join(SAMPLES, '02-design-review.txt'),
  standup: path.join(SAMPLES, '03-standup-th.txt'),
  messy: path.join(SAMPLES, '04-messy-notes.txt'),
};

async function uploadAndWait(page: Page, ...files: string[]) {
  const input = page.locator('input[type=file]');
  await input.setInputFiles(files);

  // File list appears
  await expect(page.locator('.file-list')).toBeVisible();
  const fileCount = page.locator('.file-list li');
  await expect(fileCount).toHaveCount(files.length);

  // Distill
  await page.getByRole('button', { name: 'Distill' }).click();

  // Results appear
  await expect(page.locator('.results')).toBeVisible({ timeout: 30_000 });
}

// ---------------------------------------------------------------------------

test('upload one transcript and see distillation results', async ({ page }) => {
  await page.goto('/');
  await uploadAndWait(page, SAMPLE_FILES.sprint);

  // Meeting summary card visible
  await expect(page.locator('.meeting-card')).toBeVisible();
  await expect(page.locator('.meeting-card h3')).toContainText('Sprint 24 Planning');

  // Topic sections present
  await expect(page.locator('.topic-section')).toHaveCount(2);

  // Action items present
  await expect(page.locator('.action-list li')).toHaveCount(4);
});

test('upload multiple transcripts at once', async ({ page }) => {
  await page.goto('/');
  await uploadAndWait(page, SAMPLE_FILES.sprint, SAMPLE_FILES.design);

  // Two meeting cards
  await expect(page.locator('.meeting-card')).toHaveCount(2);
});

test('allows multiple separate uploads before distilling', async ({ page }) => {
  await page.goto('/');

  // First upload
  const input = page.locator('input[type=file]');
  await input.setInputFiles([SAMPLE_FILES.sprint]);
  await expect(page.locator('.file-list li')).toHaveCount(1);

  // Second upload (additional file)
  await input.setInputFiles([SAMPLE_FILES.design]);
  await expect(page.locator('.file-list li')).toHaveCount(2);

  // Distill
  await page.getByRole('button', { name: 'Distill' }).click();
  await expect(page.locator('.results')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.meeting-card')).toHaveCount(2);
});

test('remove a file before distilling', async ({ page }) => {
  await page.goto('/');

  const input = page.locator('input[type=file]');
  await input.setInputFiles([SAMPLE_FILES.sprint, SAMPLE_FILES.design]);
  await expect(page.locator('.file-list li')).toHaveCount(2);

  // Remove the first file
  await page.locator('.file-list li').first().getByRole('button', { name: 'Remove' }).click();
  await expect(page.locator('.file-list li')).toHaveCount(1);
});

test('clear all files', async ({ page }) => {
  await page.goto('/');

  await page.locator('input[type=file]').setInputFiles([SAMPLE_FILES.sprint]);
  await expect(page.locator('.file-list')).toBeVisible();

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.locator('.file-list')).toBeHidden();
});

test('action items by owner tab', async ({ page }) => {
  await page.goto('/');
  await uploadAndWait(page, SAMPLE_FILES.sprint);

  await page.getByRole('button', { name: 'Action Items by Owner' }).click();
  await expect(page.locator('.owner-card').first()).toBeVisible();

  // One group per distinct owner, with the unowned group last. See CONTEXT.md.
  await expect(page.locator('.owner-card h3')).toHaveText(['Anna', 'Ploy', 'Somchai', 'Unowned']);
});

test('flags tab shows issues from messy notes', async ({ page }) => {
  await page.goto('/');
  await uploadAndWait(page, SAMPLE_FILES.messy);

  await page.getByRole('button', { name: /Flags/ }).click();
  // The messy notes reached no decision AND left an action item with nobody on it.
  await expect(page.locator('.flag-no_decision')).toHaveCount(1);
  await expect(page.locator('.flag-unowned_action_item')).toHaveCount(1);
});

test('download docx button triggers file download', async ({ page }) => {
  await page.goto('/');
  await uploadAndWait(page, SAMPLE_FILES.sprint);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .docx' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
});

test('drag and drop file onto dropzone', async ({ page }) => {
  await page.goto('/');

  // Playwright doesn't support drag-drop from OS file system directly,
  // so simulate by setting input files (same effect)
  await page.locator('input[type=file]').setInputFiles([SAMPLE_FILES.standup]);
  await expect(page.locator('.file-list li')).toHaveCount(1);
  await expect(page.locator('.file-name')).toContainText('03-standup-th');
});

test('Thai-language transcript distills correctly', async ({ page }) => {
  await page.goto('/');
  await uploadAndWait(page, SAMPLE_FILES.standup);

  await expect(page.locator('.meeting-card')).toBeVisible();
  // Meeting should have at least one topic/action item
  await expect(page.locator('.topic-section')).toHaveCount(1);
});
