import 'reflect-metadata';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';
import { apiSpecDoc } from './api-spec';
import { architectureDoc, readCompose } from './architecture';
import { dataDictionaryDoc } from './data-dictionary';
import { DIAGRAMS_DIR, docMarkdown, REPO_ROOT } from './markdown';
import { sequenceDoc } from './sequences';
import { takeSnapshot } from './snapshot';
import { createProgram } from './source';

// npm run diagrams: regenerates docs/diagrams/*.md from the code. Needs Docker, for the
// throwaway PostgreSQL and for `docker compose config`.
async function main(): Promise<void> {
  const { openApi, schema } = await takeSnapshot();
  const program = createProgram();
  const docs = [
    apiSpecDoc(openApi),
    architectureDoc(program, readCompose()),
    sequenceDoc(program, openApi),
    dataDictionaryDoc(schema),
  ];
  mkdirSync(DIAGRAMS_DIR, { recursive: true });
  for (const doc of docs) {
    const file = path.join(DIAGRAMS_DIR, doc.file);
    // Formatted with the repo's Prettier config, so format-on-save leaves the files alone.
    const config = await resolveConfig(file);
    const markdown = await format(docMarkdown(doc), { ...config, parser: 'markdown' });
    const changed = !existsSync(file) || readFileSync(file, 'utf8') !== markdown;
    if (changed) writeFileSync(file, markdown);
    console.log(`${changed ? 'updated  ' : 'unchanged'} ${path.relative(REPO_ROOT, file)}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
