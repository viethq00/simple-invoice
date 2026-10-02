export interface DocSection {
  heading: string;
  content: string;
}

// The "## " sections of a generated doc. A "## " line inside a code block is not a heading.
export function splitSections(markdown: string): DocSection[] {
  const sections: { heading: string; lines: string[] }[] = [];
  let fenced = false;
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    if (!fenced && line.startsWith('## ')) {
      sections.push({ heading: line.slice(3).trim(), lines: [] });
    } else {
      sections.at(-1)?.lines.push(line);
    }
  }
  return sections.map(({ heading, lines }) => ({ heading, content: lines.join('\n').trim() }));
}

export interface SectionChange {
  heading: string;
  change: 'added' | 'changed' | 'removed';
  before: string;
  after: string;
}

// Sections added, changed or removed between two versions of a doc, in the order of the new one
// (removed sections last).
export function changedSections(before: string, after: string): SectionChange[] {
  const previous = new Map(splitSections(before).map(({ heading, content }) => [heading, content]));
  const changes: SectionChange[] = [];
  for (const { heading, content } of splitSections(after)) {
    const old = previous.get(heading);
    previous.delete(heading);
    if (old === undefined) changes.push({ heading, change: 'added', before: '', after: content });
    else if (old !== content)
      changes.push({ heading, change: 'changed', before: old, after: content });
  }
  for (const [heading, content] of previous) {
    changes.push({ heading, change: 'removed', before: content, after: '' });
  }
  return changes;
}

// A line diff with `context` unchanged lines around each change, like `diff -u` without the
// file headers.
export function lineDiff(before: string, after: string, context = 3): string {
  const a = before === '' ? [] : before.split('\n');
  const b = after === '' ? [] : after.split('\n');
  // common[i][j]: length of the longest common subsequence of a[i..] and b[j..]
  const common = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      common[i][j] =
        a[i] === b[j] ? common[i + 1][j + 1] + 1 : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }
  const lines: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push(` ${a[i++]}`);
      j++;
    } else if (i < a.length && (j === b.length || common[i + 1][j] >= common[i][j + 1])) {
      lines.push(`-${a[i++]}`);
    } else {
      lines.push(`+${b[j++]}`);
    }
  }

  const changed = lines.flatMap((line, index) => (line.startsWith(' ') ? [] : [index]));
  const near = (index: number) => changed.some((c) => Math.abs(c - index) <= context);
  const output: string[] = [];
  lines.forEach((line, index) => {
    if (!near(index)) return;
    if (output.length > 0 && !near(index - 1)) output.push('@@');
    output.push(line);
  });
  return output.join('\n');
}
