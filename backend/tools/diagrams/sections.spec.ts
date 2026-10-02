import { changedSections, lineDiff, splitSections } from './sections';

const doc = (...sections: string[]) => ['# Title', 'Intro.', ...sections].join('\n\n');

describe('splitSections', () => {
  it('splits on "## " headings and ignores them inside code blocks', () => {
    const markdown = doc('## One\n\n```\n## not a heading\n```', '## Two\n\nText.');
    expect(splitSections(markdown)).toEqual([
      { heading: 'One', content: '```\n## not a heading\n```' },
      { heading: 'Two', content: 'Text.' },
    ]);
  });
});

describe('changedSections', () => {
  it('reports added, changed and removed sections, in the order of the new doc', () => {
    const before = doc('## Kept\n\nSame.', '## Edited\n\nOld.', '## Dropped\n\nGone.');
    const after = doc('## New\n\nFresh.', '## Kept\n\nSame.', '## Edited\n\nNew.');
    expect(changedSections(before, after)).toEqual([
      { heading: 'New', change: 'added', before: '', after: 'Fresh.' },
      { heading: 'Edited', change: 'changed', before: 'Old.', after: 'New.' },
      { heading: 'Dropped', change: 'removed', before: 'Gone.', after: '' },
    ]);
  });

  it('reports nothing when only the intro changes', () => {
    expect(changedSections('# A\n\nOne.\n\n## S\n\nx', '# A\n\nTwo.\n\n## S\n\nx')).toEqual([]);
  });
});

describe('lineDiff', () => {
  const lines = (count: number) => Array.from({ length: count }, (_, i) => `line ${i + 1}`);

  it('keeps three lines of context around a change', () => {
    const before = lines(10);
    const after = [...before];
    after[5] = 'changed';
    expect(lineDiff(before.join('\n'), after.join('\n')).split('\n')).toEqual([
      ' line 3',
      ' line 4',
      ' line 5',
      '-line 6',
      '+changed',
      ' line 7',
      ' line 8',
      ' line 9',
    ]);
  });

  it('separates changes that are far apart', () => {
    const before = lines(20);
    const after = before.map((line, i) => (i === 1 || i === 18 ? `${line}!` : line));
    expect(lineDiff(before.join('\n'), after.join('\n'))).toContain(' line 5\n@@\n line 16');
  });

  it('handles a section that was added or removed', () => {
    expect(lineDiff('', 'a\nb')).toBe('+a\n+b');
    expect(lineDiff('a\nb', '')).toBe('-a\n-b');
  });
});
