import path from 'node:path';
import ts from 'typescript';

const BACKEND_ROOT = path.resolve(__dirname, '../..');

// The API's source under src/ (no tests), with the backend's compiler options. Tests pass
// their own fixture files instead.
export function createProgram(rootNames?: string[]): ts.Program {
  const config = ts.getParsedCommandLineOfConfigFile(
    path.join(BACKEND_ROOT, 'tsconfig.json'),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );
  if (!config) throw new Error('Cannot read tsconfig.json');
  const src = path.join(BACKEND_ROOT, 'src') + path.sep;
  const roots =
    rootNames ??
    config.fileNames.filter(
      (file) => path.resolve(file).startsWith(src) && !file.endsWith('.spec.ts'),
    );
  return ts.createProgram(roots, config.options);
}

// Code in this repository, as opposed to a library in node_modules.
export function isOwnFile(fileName: string): boolean {
  return !fileName.includes('/node_modules/') && !fileName.endsWith('.d.ts');
}

export function ownSourceFiles(program: ts.Program): ts.SourceFile[] {
  return program.getSourceFiles().filter((file) => isOwnFile(file.fileName));
}

export function decorators(node: ts.Node): readonly ts.Decorator[] {
  return (ts.canHaveDecorators(node) && ts.getDecorators(node)) || [];
}

export function decorator(node: ts.Node, name: string): ts.CallExpression | undefined {
  for (const { expression } of decorators(node)) {
    if (ts.isCallExpression(expression) && expression.expression.getText() === name) {
      return expression;
    }
  }
  return undefined;
}

// "node_modules/@nestjs/jwt/dist/jwt.service.d.ts" -> "@nestjs/jwt", and types from
// @types/passport-jwt -> "passport-jwt".
export function packageOf(declaration: ts.Node | undefined): string | undefined {
  const file = declaration?.getSourceFile().fileName ?? '';
  const name = [...file.matchAll(/node_modules\/((?:@[^/]+\/)?[^/]+)/g)].pop()?.[1];
  return name?.replace(/^@types\//, '');
}

// The class a value is an instance of: `new ParseUUIDPipe()`, a const holding one, or the class.
export function instanceType(checker: ts.TypeChecker, expression: ts.Expression): string {
  return checker.typeToString(checker.getTypeAtLocation(expression)).replace(/^typeof /, '');
}

export function property(
  object: ts.Expression | undefined,
  name: string,
): ts.Expression | undefined {
  if (!object || !ts.isObjectLiteralExpression(object)) return undefined;
  for (const element of object.properties) {
    if (ts.isPropertyAssignment(element) && element.name.getText() === name) {
      return element.initializer;
    }
  }
  return undefined;
}

// Follows import aliases to where a symbol is declared.
export function declarationOf(checker: ts.TypeChecker, node: ts.Node): ts.Declaration | undefined {
  let symbol = checker.getSymbolAtLocation(node);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return symbol?.declarations?.[0];
}

export function isOwnDeclaration(declaration: ts.Node | undefined): boolean {
  return declaration !== undefined && isOwnFile(declaration.getSourceFile().fileName);
}

export function ownClasses(program: ts.Program): Map<string, ts.ClassDeclaration> {
  const classes = new Map<string, ts.ClassDeclaration>();
  for (const file of ownSourceFiles(program)) {
    ts.forEachChild(file, (node) => {
      if (ts.isClassDeclaration(node) && node.name) classes.set(node.name.text, node);
    });
  }
  return classes;
}

export interface ModuleImport {
  name: string;
  // forRoot, forFeature, registerAsync...
  method?: string;
  // Class names passed in an array, as in TypeOrmModule.forFeature([User]).
  args: string[];
  own: boolean;
}

export interface Provider {
  name: string;
  token?: string;
  kind: 'class' | 'useClass' | 'useFactory' | 'useValue' | 'useExisting';
  // Injected by a factory's `inject: [...]`.
  inject: string[];
}

export interface NestModule {
  name: string;
  global: boolean;
  imports: ModuleImport[];
  controllers: string[];
  providers: Provider[];
  exports: string[];
}

const elements = (expression: ts.Expression | undefined): ts.Expression[] =>
  expression && ts.isArrayLiteralExpression(expression) ? [...expression.elements] : [];

const names = (expression: ts.Expression | undefined): string[] =>
  elements(expression).map((element) => element.getText());

function moduleImport(checker: ts.TypeChecker, expression: ts.Expression): ModuleImport {
  if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
    const target = expression.expression.expression;
    return {
      name: target.getText(),
      method: expression.expression.name.text,
      args: expression.arguments.flatMap((argument) => names(argument)),
      own: isOwnDeclaration(declarationOf(checker, target)),
    };
  }
  return {
    name: expression.getText(),
    args: [],
    own: isOwnDeclaration(declarationOf(checker, expression)),
  };
}

function provider(expression: ts.Expression): Provider {
  if (!ts.isObjectLiteralExpression(expression)) {
    return { name: expression.getText(), kind: 'class', inject: [] };
  }
  const token = property(expression, 'provide')?.getText() ?? '?';
  for (const kind of ['useClass', 'useExisting', 'useFactory', 'useValue'] as const) {
    const value = property(expression, kind);
    if (!value) continue;
    const named = kind === 'useClass' || kind === 'useExisting';
    return {
      name: named ? value.getText() : token,
      token: named ? token : undefined,
      kind,
      inject: names(property(expression, 'inject')),
    };
  }
  return { name: token, kind: 'useValue', inject: [] };
}

export function readModules(program: ts.Program): NestModule[] {
  const checker = program.getTypeChecker();
  const modules: NestModule[] = [];
  for (const declaration of ownClasses(program).values()) {
    const options = decorator(declaration, 'Module')?.arguments[0];
    if (!options || !declaration.name) continue;
    modules.push({
      name: declaration.name.text,
      global: decorator(declaration, 'Global') !== undefined,
      imports: elements(property(options, 'imports')).map((e) => moduleImport(checker, e)),
      controllers: names(property(options, 'controllers')),
      providers: elements(property(options, 'providers')).map(provider),
      exports: names(property(options, 'exports')),
    });
  }
  return modules;
}

// Constructor parameters, as the DI container sees them.
export function constructorDependencies(
  checker: ts.TypeChecker,
  declaration: ts.ClassDeclaration,
): { name: string; type: string; own: boolean; declaration?: ts.Declaration }[] {
  const constructor = declaration.members.find(ts.isConstructorDeclaration);
  return (constructor?.parameters ?? []).map((parameter) => {
    const type = checker.getTypeAtLocation(parameter);
    const typeDeclaration = type.getSymbol()?.declarations?.[0];
    return {
      name: parameter.name.getText(),
      type: checker.typeToString(type),
      own: isOwnDeclaration(typeDeclaration),
      declaration: typeDeclaration,
    };
  });
}
