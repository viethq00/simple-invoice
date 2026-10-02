import {
  commentBody,
  compareDocs,
  GitHubError,
  MARKER,
  upsertComment,
  type GitHub,
} from './pr-comment';

const doc = (title: string, ...sections: string[]) =>
  [`# ${title}`, 'Intro.', ...sections].join('\n\n');

describe('compareDocs', () => {
  it('lists the changed sections of each doc, titled by its heading', () => {
    const base = new Map([
      ['api-spec.md', doc('API spec', '## Orders\n\nold')],
      ['gone.md', doc('Gone', '## Only\n\nx')],
      ['same.md', doc('Same', '## S\n\ny')],
    ]);
    const head = new Map([
      ['api-spec.md', doc('API spec', '## Orders\n\nnew')],
      ['same.md', doc('Same', '## S\n\ny')],
    ]);
    expect(compareDocs(base, head)).toEqual([
      {
        file: 'api-spec.md',
        title: 'API spec',
        changes: [{ heading: 'Orders', change: 'changed', before: 'old', after: 'new' }],
      },
      {
        file: 'gone.md',
        title: 'Gone',
        changes: [{ heading: 'Only', change: 'removed', before: 'x', after: '' }],
      },
    ]);
  });
});

describe('commentBody', () => {
  const diagram = '```mermaid\nflowchart LR\n  a --> b\n```';
  const docs = compareDocs(
    new Map([['api-spec.md', doc('API spec', `## Orders\n\n${diagram}`, '## Old\n\nx')]]),
    new Map([
      ['api-spec.md', doc('API spec', `## Orders\n\n${diagram.replace('b', 'c')}`, '## New\n\ny')],
    ]),
  );

  it('starts with the marker and shows each changed section with its source diff', () => {
    const body = commentBody(docs, {
      stale: [],
      commit: 'abc1234',
      link: (file) => `https://example.test/${file}`,
    });
    expect(body.startsWith(`${MARKER}\n\n### Diagram changes`)).toBe(true);
    expect(body).toContain('This pull request changes 3 sections of the generated docs');
    expect(body).toContain('as of abc1234.');
    expect(body).toContain('#### [API spec](https://example.test/api-spec.md)');
    expect(body).toContain('<summary><b>Orders</b> (changed)</summary>');
    expect(body).toContain(diagram.replace('b', 'c'));
    // The diff fence is longer than the ``` fences inside it.
    expect(body).toContain(
      '````diff\n ```mermaid\n flowchart LR\n-  a --> b\n+  a --> c\n ```\n````',
    );
    expect(body).toContain('<details open>\n\n<summary><b>New</b> (added)</summary>');
    expect(body).toContain(
      '<details>\n\n<summary><b>Old</b> (removed)</summary>\n\n````diff\n-x\n````',
    );
  });

  it('says so when no diagram changes', () => {
    expect(commentBody([], { stale: [], commit: 'abc1234' })).toBe(
      `${MARKER}\n\n### Diagram changes\n\nNo diagram in \`docs/diagrams\` changes in this pull request as of abc1234.`,
    );
  });

  it('warns when the committed docs are out of date', () => {
    expect(commentBody([], { stale: ['api-spec.md'] })).toContain(
      '> [!WARNING]\n> The committed `api-spec.md` in `docs/diagrams` is out of date. Run ' +
        '`npm run diagrams` and commit the result.',
    );
  });

  it('drops detail to stay under the GitHub comment size limit', () => {
    const big = 'x'.repeat(40_000);
    const large = compareDocs(
      new Map([['a.md', doc('A', `## One\n\n${big}a`)]]),
      new Map([['a.md', doc('A', `## One\n\n${big}b`)]]),
    );
    const body = commentBody(large, { stale: [] });
    expect(body.length).toBeLessThanOrEqual(65_536);
    expect(body).toContain(`${big}b`);
    expect(body).not.toContain('Source diff');

    const huge = compareDocs(
      new Map([['a.md', doc('A', `## One\n\n${big}${big}a`)]]),
      new Map([['a.md', doc('A', `## One\n\n${big}${big}b`)]]),
    );
    const list = commentBody(huge, { stale: [] });
    expect(list).toContain('- One (changed)');
    expect(list).toContain('They are too large to show here');
    expect(list.length).toBeLessThan(1_000);
  });
});

describe('upsertComment', () => {
  const comment = (id: number, body: string) => ({ id, body });

  // A fake GitHub API: GET pages of comments, record POST and PATCH.
  function fakeGitHub(pages: { id: number; body: string }[][], status = 200) {
    const calls: { method: string; url: string; body?: unknown }[] = [];
    const fetch = jest.fn((url: string, init: RequestInit) => {
      const method = init.method ?? 'GET';
      calls.push({ method, url, body: init.body ? JSON.parse(init.body as string) : undefined });
      const page = Number(new URL(url).searchParams.get('page') ?? 1);
      const data = method === 'GET' ? (pages[page - 1] ?? []) : { id: 1 };
      return Promise.resolve(new Response(JSON.stringify(data), { status }));
    });
    const github: GitHub = {
      apiUrl: 'https://api.github.test',
      token: 'token',
      repository: 'owner/repo',
      issue: 7,
      fetch: fetch as unknown as typeof globalThis.fetch,
    };
    return { github, calls, fetch };
  }

  it('creates the comment when there are changes and no comment yet', async () => {
    const { github, calls, fetch } = fakeGitHub([[comment(1, 'Looks good!')]]);
    await expect(upsertComment(github, `${MARKER}\nbody`, true)).resolves.toBe('created');
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET https://api.github.test/repos/owner/repo/issues/7/comments?per_page=100&page=1',
      'POST https://api.github.test/repos/owner/repo/issues/7/comments',
    ]);
    expect(calls[1].body).toEqual({ body: `${MARKER}\nbody` });
    expect(fetch.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer token' });
  });

  it('does not start a comment just to say nothing changed', async () => {
    const { github, calls } = fakeGitHub([[]]);
    await expect(upsertComment(github, `${MARKER}\nnothing`, false)).resolves.toBe('skipped');
    expect(calls.map((c) => c.method)).toEqual(['GET']);
  });

  it('updates its own comment, looking past the first page and past quotes of it', async () => {
    const quoted = comment(5, `> ${MARKER}\n> old`);
    const pages = [
      Array.from({ length: 100 }, (_, i) => comment(i + 10, 'hi')),
      [quoted, comment(42, `${MARKER}\nold`)],
    ];
    const { github, calls } = fakeGitHub(pages);
    await expect(upsertComment(github, `${MARKER}\nnew`, false)).resolves.toBe('updated');
    expect(calls.at(-1)).toEqual({
      method: 'PATCH',
      url: 'https://api.github.test/repos/owner/repo/issues/comments/42',
      body: { body: `${MARKER}\nnew` },
    });
  });

  it('leaves an identical comment alone', async () => {
    const { github, calls } = fakeGitHub([[comment(42, `${MARKER}\nsame`)]]);
    await expect(upsertComment(github, `${MARKER}\nsame`, true)).resolves.toBe('unchanged');
    expect(calls.map((c) => c.method)).toEqual(['GET']);
  });

  it('reports the HTTP status when GitHub refuses', async () => {
    const { github } = fakeGitHub([[]], 403);
    const error = await upsertComment(github, `${MARKER}\nbody`, true).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitHubError);
    expect((error as GitHubError).status).toBe(403);
  });
});
