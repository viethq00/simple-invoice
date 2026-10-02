import { byText } from './markdown';
import { changedSections, lineDiff, type SectionChange } from './sections';

export const MARKER = '<!-- simple-invoice-diagrams -->';
// GitHub rejects comment bodies longer than this.
const MAX_LENGTH = 65_536;
export const DOCS_PATH = 'docs/diagrams';

export interface DocChanges {
  file: string;
  title: string;
  changes: SectionChange[];
}

export function compareDocs(base: Map<string, string>, head: Map<string, string>): DocChanges[] {
  const files = [...new Set([...head.keys(), ...base.keys()])].sort(byText);
  return files.flatMap((file) => {
    const after = head.get(file) ?? '';
    const before = base.get(file) ?? '';
    const title = /^# (.+)$/m.exec(after || before)?.[1] ?? file;
    const changes = changedSections(before, after);
    return changes.length > 0 ? [{ file, title, changes }] : [];
  });
}

export interface CommentOptions {
  // Docs whose committed copy differs from the generated one.
  stale: string[];
  commit?: string;
  link?: (file: string) => string;
}

type Detail = 'full' | 'diagrams' | 'list';

function section(change: SectionChange, detail: Detail): string {
  if (detail === 'list') return `- ${change.heading} (${change.change})`;
  const parts = [
    `<details${change.change === 'removed' ? '' : ' open'}>`,
    `<summary><b>${change.heading}</b> (${change.change})</summary>`,
  ];
  if (change.change !== 'removed') parts.push(change.after);
  if (detail === 'full' && change.change !== 'added') {
    // Four backticks: the diff itself contains ``` lines.
    const diff = ['````diff', lineDiff(change.before, change.after), '````'].join('\n');
    parts.push(
      change.change === 'removed'
        ? diff
        : ['<details>', '<summary>Source diff</summary>', diff, '</details>'].join('\n\n'),
    );
  }
  parts.push('</details>');
  return parts.join('\n\n');
}

function render(docs: DocChanges[], options: CommentOptions, detail: Detail): string {
  const as = options.commit ? ` as of ${options.commit}` : '';
  const parts = [MARKER, '### Diagram changes'];
  if (options.stale.length > 0) {
    parts.push(
      [
        '> [!WARNING]',
        `> The committed ${options.stale.map((file) => `\`${file}\``).join(', ')} in ` +
          `\`${DOCS_PATH}\` ${options.stale.length === 1 ? 'is' : 'are'} out of date. Run ` +
          '`npm run diagrams` and commit the result.',
      ].join('\n'),
    );
  }
  if (docs.length === 0) {
    parts.push(`No diagram in \`${DOCS_PATH}\` changes in this pull request${as}.`);
    return parts.join('\n\n');
  }
  const count = docs.reduce((total, doc) => total + doc.changes.length, 0);
  parts.push(
    `This pull request changes ${count} ${count === 1 ? 'section' : 'sections'} of the ` +
      `generated docs in \`${DOCS_PATH}\`${as}.` +
      (detail === 'list' ? ' They are too large to show here; open the files instead.' : ''),
  );
  for (const doc of docs) {
    const title = options.link ? `[${doc.title}](${options.link(doc.file)})` : doc.title;
    parts.push(`#### ${title}`, doc.changes.map((change) => section(change, detail)).join('\n\n'));
  }
  return parts.join('\n\n');
}

// As much detail as fits in one comment.
export function commentBody(docs: DocChanges[], options: CommentOptions): string {
  const details: Detail[] = ['full', 'diagrams', 'list'];
  for (const detail of details) {
    const body = render(docs, options, detail);
    if (body.length <= MAX_LENGTH) return body;
  }
  return render(docs, options, 'list').slice(0, MAX_LENGTH);
}

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface GitHub {
  apiUrl: string;
  token: string;
  repository: string;
  issue: number;
  fetch?: typeof fetch;
}

interface Comment {
  id: number;
  body?: string;
}

// Updates the comment that starts with MARKER, or creates it when there is something to say.
export async function upsertComment(
  github: GitHub,
  body: string,
  hasChanges: boolean,
): Promise<'created' | 'updated' | 'unchanged' | 'skipped'> {
  const request = async (method: string, route: string, payload?: unknown): Promise<unknown> => {
    const response = await (github.fetch ?? fetch)(`${github.apiUrl}${route}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${github.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new GitHubError(
        response.status,
        `${method} ${route} failed: ${response.status} ${await response.text()}`,
      );
    }
    return response.json();
  };

  const issue = `/repos/${github.repository}/issues/${github.issue}`;
  let existing: Comment | undefined;
  for (let page = 1; !existing; page++) {
    const comments = (await request(
      'GET',
      `${issue}/comments?per_page=100&page=${page}`,
    )) as Comment[];
    existing = comments.find((comment) => comment.body?.startsWith(MARKER));
    if (comments.length < 100) break;
  }
  if (existing) {
    if (existing.body === body) return 'unchanged';
    await request('PATCH', `/repos/${github.repository}/issues/comments/${existing.id}`, { body });
    return 'updated';
  }
  if (!hasChanges) return 'skipped';
  await request('POST', `${issue}/comments`, { body });
  return 'created';
}
