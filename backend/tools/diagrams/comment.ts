import { spawnSync } from 'node:child_process';
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { byText, DIAGRAMS_DIR, REPO_ROOT } from './markdown';
import { commentBody, compareDocs, DOCS_PATH, GitHubError, upsertComment } from './pr-comment';

// npm run diagrams:comment, after npm run diagrams on a pull request: compares the generated
// docs with the base commit and keeps one comment on the pull request up to date.
// --dry-run prints the comment instead.

function git(...args: string[]): string | undefined {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout : undefined;
}

// The docs as committed at `ref`.
function committedDocs(ref: string): Map<string, string> {
  const files = (git('ls-tree', '--name-only', `${ref}:${DOCS_PATH}`) ?? '')
    .split('\n')
    .filter((file) => file.endsWith('.md'));
  return new Map(files.map((file) => [file, git('show', `${ref}:${DOCS_PATH}/${file}`) ?? '']));
}

function generatedDocs(): Map<string, string> {
  const files = readdirSync(DIAGRAMS_DIR).filter((file) => file.endsWith('.md'));
  return new Map(files.map((file) => [file, readFileSync(path.join(DIAGRAMS_DIR, file), 'utf8')]));
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const base = required('BASE_SHA');
  if (!git('rev-parse', '--verify', '--quiet', `${base}^{commit}`)) {
    throw new Error(`Base commit ${base} is not in this clone. Check out with fetch-depth: 0.`);
  }

  const generated = generatedDocs();
  const committed = committedDocs('HEAD');
  const stale = [...new Set([...generated.keys(), ...committed.keys()])]
    .filter((file) => generated.get(file) !== committed.get(file))
    .sort(byText);
  const docs = compareDocs(committedDocs(base), generated);

  const { HEAD_SHA, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_STEP_SUMMARY } = process.env;
  const body = commentBody(docs, {
    stale,
    commit: HEAD_SHA?.slice(0, 7),
    link:
      HEAD_SHA && GITHUB_SERVER_URL && GITHUB_REPOSITORY
        ? (file) =>
            `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/blob/${HEAD_SHA}/${DOCS_PATH}/${file}`
        : undefined,
  });
  if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${body}\n`);
  if (dryRun) {
    console.log(body);
    return;
  }

  try {
    const result = await upsertComment(
      {
        apiUrl: process.env.GITHUB_API_URL ?? 'https://api.github.com',
        token: required('GITHUB_TOKEN'),
        repository: required('GITHUB_REPOSITORY'),
        issue: Number(required('PR_NUMBER')),
      },
      body,
      docs.length > 0,
    );
    console.log(`Diagram comment: ${result}.`);
  } catch (error) {
    // Pull requests from forks get a read-only token.
    if (error instanceof GitHubError && error.status === 403) {
      console.log(
        '::warning::No permission to comment on this pull request. The diagram changes are ' +
          'in the job summary instead.',
      );
      return;
    }
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
