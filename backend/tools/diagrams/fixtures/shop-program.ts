import { readdirSync } from 'node:fs';
import path from 'node:path';
import type ts from 'typescript';
import { createProgram } from '../source';

const SHOP = path.join(__dirname, 'shop');

// The fixture app, read the way createProgram() reads the API.
export function shopProgram(): ts.Program {
  return createProgram(readdirSync(SHOP).map((file) => path.join(SHOP, file)));
}
