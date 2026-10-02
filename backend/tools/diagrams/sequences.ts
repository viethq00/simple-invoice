import * as nestCommon from '@nestjs/common';
import type { OpenAPIObject, ResponseObject } from '@nestjs/swagger';
import { STATUS_CODES } from 'node:http';
import path from 'node:path';
import ts from 'typescript';
import { listOperations, schemaLabel, successResponse, type Operation } from './api-spec';
import { escapeText, mermaid, REPO_ROOT, type Doc, type Section } from './markdown';
import {
  declarationOf,
  decorator,
  decorators,
  instanceType,
  isOwnDeclaration,
  ownClasses,
  ownSourceFiles,
  packageOf,
  property,
  readModules,
} from './source';

type Text = string | string[];

interface Branch {
  label: string;
  steps: Step[];
}

type Step =
  | { kind: 'message'; from: string; to: string; text: Text }
  | {
      kind: 'call';
      from: string;
      to: string;
      text: Text;
      steps: Step[];
      reply: string;
      replyTo?: string;
    }
  | { kind: 'self'; on: string; text: string }
  | { kind: 'error'; from: string; status: number; text: string }
  | { kind: 'block'; type: 'opt' | 'alt' | 'loop'; branches: Branch[] };

interface Frame {
  // Who runs the code being traced.
  participant: string;
  // A controller's @Res() parameter: calls on it change the HTTP response.
  response?: ts.Declaration;
}

const CLIENT = 'Client';
const DATABASE = 'DB';
const ITERATORS = new Set([
  'map',
  'flatMap',
  'forEach',
  'filter',
  'find',
  'some',
  'every',
  'reduce',
]);
// Library guards: their source isn't available, so the status they reject with is listed here.
// AuthGuard('jwt') is looked up as AuthGuard.
const LIBRARY_GUARD_STATUS: Record<string, number> = { AuthGuard: 401, ThrottlerGuard: 429 };
// Pipes that only fill in or reshape a value, so they have no 400 to draw.
const PIPES_THAT_NEVER_REJECT = new Set(['DefaultValuePipe']);

const block = (type: 'opt' | 'alt' | 'loop', ...branches: Branch[]): Step => ({
  kind: 'block',
  type,
  branches,
});

function condition(expression: ts.Expression): string {
  const text = expression
    .getText()
    .replace(/\bawait\s+/g, '')
    .replace(/\s+/g, ' ');
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

// Arguments as written when short and simple, otherwise "...".
function argumentList(call: ts.CallExpression): string {
  return call.arguments
    .map((argument) => {
      const simple =
        ts.isIdentifier(argument) ||
        ts.isPropertyAccessExpression(argument) ||
        ts.isStringLiteralLike(argument) ||
        ts.isNumericLiteral(argument);
      return simple && argument.getText().length <= 30 ? argument.getText() : '...';
    })
    .join(', ');
}

function message(argument: ts.Expression | undefined): string | undefined {
  if (argument && ts.isStringLiteralLike(argument)) return argument.text;
  if (argument && ts.isConditionalExpression(argument)) {
    const [whenTrue, whenFalse] = [message(argument.whenTrue), message(argument.whenFalse)];
    if (whenTrue && whenFalse) return `${whenTrue} / ${whenFalse}`;
  }
  return undefined;
}

function hasBody(node: ts.Node | undefined): node is ts.FunctionLikeDeclaration {
  return (
    node !== undefined &&
    (ts.isMethodDeclaration(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)) &&
    node.body !== undefined
  );
}

function isAwaited(node: ts.Node): boolean {
  let parent = node.parent;
  while (ts.isParenthesizedExpression(parent)) parent = parent.parent;
  return ts.isAwaitExpression(parent);
}

const isThisProperty = (node: ts.Expression): node is ts.PropertyAccessExpression =>
  ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword;

const method = (declaration: ts.ClassDeclaration, name: string) =>
  declaration.members.find(
    (member): member is ts.MethodDeclaration =>
      ts.isMethodDeclaration(member) && member.name.getText() === name,
  );

class Tracer {
  readonly participants = new Map<string, string>();
  private readonly stack: ts.Node[] = [];

  constructor(private readonly checker: ts.TypeChecker) {}

  // A Mermaid id is a plain word, so AuthGuard('jwt') becomes AuthGuard_jwt, labelled as written.
  participant(name: string, label = name): string {
    const id = name.replace(/\W+/g, '_').replace(/^_+|_+$/g, '');
    if (!this.participants.has(id)) this.participants.set(id, label);
    return id;
  }

  body(declaration: ts.FunctionLikeDeclaration, frame: Frame): Step[] {
    const steps: Step[] = [];
    if (!declaration.body || this.stack.includes(declaration)) return steps;
    this.stack.push(declaration);
    if (ts.isBlock(declaration.body)) this.statements(declaration.body.statements, frame, steps);
    else this.expression(declaration.body, frame, steps);
    this.stack.pop();
    return steps;
  }

  private statements(statements: readonly ts.Statement[], frame: Frame, out: Step[]): void {
    for (const statement of statements) this.statement(statement, frame, out);
  }

  private collect(statement: ts.Statement | undefined, frame: Frame): Step[] {
    const steps: Step[] = [];
    if (statement) this.statement(statement, frame, steps);
    return steps;
  }

  private statement(node: ts.Statement, frame: Frame, out: Step[]): void {
    if (ts.isBlock(node)) {
      this.statements(node.statements, frame, out);
    } else if (ts.isIfStatement(node)) {
      const branches: Branch[] = [];
      let current: ts.Statement | undefined = node;
      while (current && ts.isIfStatement(current)) {
        this.expression(current.expression, frame, out);
        branches.push({
          label: condition(current.expression),
          steps: this.collect(current.thenStatement, frame),
        });
        current = current.elseStatement;
      }
      if (current) branches.push({ label: 'else', steps: this.collect(current, frame) });
      while (branches.length > 0 && branches[branches.length - 1].steps.length === 0)
        branches.pop();
      if (branches.length === 1) out.push(block('opt', branches[0]));
      else if (branches.length > 1) out.push(block('alt', ...branches));
    } else if (ts.isTryStatement(node)) {
      this.statements(node.tryBlock.statements, frame, out);
      const caught = this.collect(node.catchClause?.block, frame);
      const [only] = caught;
      if (caught.length === 1 && only.kind === 'block' && only.type === 'opt') {
        out.push(
          block('opt', {
            label: `on error, if ${only.branches[0].label}`,
            steps: only.branches[0].steps,
          }),
        );
      } else if (caught.length > 0) {
        out.push(block('opt', { label: 'on error', steps: caught }));
      }
      if (node.finallyBlock) this.statements(node.finallyBlock.statements, frame, out);
    } else if (ts.isThrowStatement(node)) {
      // `throw error` rethrows: the exception filter turns unknown errors into a 500.
      this.expression(node.expression, frame, out);
      const error = this.httpError(node.expression);
      if (error) out.push({ kind: 'error', from: frame.participant, ...error });
    } else if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
      this.expression(node.expression, frame, out);
      const steps = this.collect(node.statement, frame);
      if (steps.length > 0)
        out.push(block('loop', { label: `for each in ${node.expression.getText()}`, steps }));
    } else if (ts.isForStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) {
      const test = ts.isForStatement(node) ? node.condition : node.expression;
      const steps = this.collect(node.statement, frame);
      if (steps.length > 0)
        out.push(block('loop', { label: test ? `while ${condition(test)}` : 'loop', steps }));
    } else if (ts.isSwitchStatement(node)) {
      this.expression(node.expression, frame, out);
      const branches = node.caseBlock.clauses.map((clause) => {
        const steps: Step[] = [];
        this.statements(clause.statements, frame, steps);
        const label = ts.isCaseClause(clause)
          ? `${node.expression.getText()} is ${clause.expression.getText()}`
          : 'otherwise';
        return { label, steps };
      });
      if (branches.some(({ steps }) => steps.length > 0)) out.push(block('alt', ...branches));
    } else if (ts.isVariableStatement(node)) {
      for (const { initializer } of node.declarationList.declarations) {
        if (initializer) this.expression(initializer, frame, out);
      }
    } else if (ts.isReturnStatement(node) || ts.isExpressionStatement(node)) {
      if (node.expression) this.expression(node.expression, frame, out);
    }
  }

  // Calls in evaluation order. Callbacks are traced by the call they are passed to.
  private expression(node: ts.Node, frame: Frame, out: Step[]): void {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return;
    if (ts.isCallExpression(node)) return this.call(node, frame, out);
    ts.forEachChild(node, (child) => this.expression(child, frame, out));
  }

  private call(node: ts.CallExpression, frame: Frame, out: Step[]): void {
    const callee = node.expression;
    if (ts.isPropertyAccessExpression(callee)) this.expression(callee.expression, frame, out);
    const callbacks: ts.FunctionLikeDeclaration[] = [];
    for (const argument of node.arguments) {
      if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))
        callbacks.push(argument);
      else this.expression(argument, frame, out);
    }

    const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : callee.getText();
    const text = `${name}(${argumentList(node)})`;
    const declaration = this.checker.getResolvedSignature(node)?.getDeclaration();
    const library = packageOf(declaration);
    const own = isOwnDeclaration(declaration) && hasBody(declaration) ? declaration : undefined;

    if (library === 'typeorm') {
      // Repository and query builder calls that return a promise go to the database.
      if (this.checker.getTypeAtLocation(node).getProperty('then')) {
        const to = this.participant(DATABASE);
        out.push({
          kind: 'call',
          from: frame.participant,
          to,
          text: this.query(node, name),
          steps: [],
          reply: this.reply(node),
        });
      }
    } else if (
      ts.isPropertyAccessExpression(callee) &&
      callee.expression.kind === ts.SyntaxKind.ThisKeyword
    ) {
      // this.helper(): drawn when it does something worth drawing.
      const steps = own ? this.body(own, frame) : [];
      if (steps.length > 0) out.push({ kind: 'self', on: frame.participant, text }, ...steps);
    } else if (ts.isPropertyAccessExpression(callee) && isThisProperty(callee.expression)) {
      // this.dependency.method(): a call to an injected provider.
      const symbol = this.checker.getTypeAtLocation(callee.expression).getSymbol();
      const reply = this.reply(node);
      // Library calls that return nothing (logging and the like) are left out.
      if (symbol && symbol.flags & ts.SymbolFlags.Class && (own || reply !== 'void')) {
        const to = this.participant(symbol.getName());
        out.push({
          kind: 'call',
          from: frame.participant,
          to,
          text,
          steps: own ? this.body(own, { participant: to }) : [],
          reply,
        });
      }
    } else if (
      frame.response &&
      ts.isPropertyAccessExpression(callee) &&
      declarationOf(this.checker, callee.expression) === frame.response
    ) {
      out.push({
        kind: 'self',
        on: frame.participant,
        text: `${callee.expression.getText()}.${text}`,
      });
    } else if (own && !ts.isMethodDeclaration(own)) {
      // A function of our own runs in the caller; drawn when it does something worth drawing.
      const steps = this.body(own, frame);
      if (steps.length > 0 || isAwaited(node))
        out.push({ kind: 'self', on: frame.participant, text }, ...steps);
    } else if (isAwaited(node)) {
      const owner = library && !ts.isPropertyAccessExpression(callee) ? `${library}.` : '';
      out.push({ kind: 'self', on: frame.participant, text: `${owner}${text}` });
    }

    for (const callback of callbacks) {
      const steps = this.body(callback, frame);
      if (steps.length === 0) continue;
      if (ts.isPropertyAccessExpression(callee) && ITERATORS.has(name)) {
        out.push(block('loop', { label: `for each in ${callee.expression.getText()}`, steps }));
      } else {
        out.push(...steps);
      }
    }
  }

  private reply(node: ts.CallExpression): string {
    const type = this.checker.getTypeAtLocation(node);
    const awaited = this.checker.getAwaitedType(type) ?? type;
    if (awaited.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return 'rows';
    const text = this.checker.typeToString(awaited);
    return text.length > 60 ? 'result' : text;
  }

  // "SELECT 1" for raw SQL, otherwise "findOne() on invoices".
  private query(node: ts.CallExpression, name: string): string {
    const [first] = node.arguments;
    if (name === 'query' && first && ts.isStringLiteralLike(first)) {
      return first.text.replace(/\s+/g, ' ').trim();
    }
    const callee = node.expression;
    const receiver = ts.isPropertyAccessExpression(callee)
      ? this.checker.getTypeAtLocation(callee.expression)
      : undefined;
    const table = receiver && this.table(receiver);
    return table ? `${name}() on ${table}` : `${name}()`;
  }

  // Repository<Invoice> or SelectQueryBuilder<Invoice> -> the @Entity table name.
  private table(type: ts.Type): string | undefined {
    const isReference =
      type.flags & ts.TypeFlags.Object &&
      (type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference;
    const [entity] = isReference ? this.checker.getTypeArguments(type as ts.TypeReference) : [];
    const declaration = entity?.getSymbol()?.declarations?.find(ts.isClassDeclaration);
    const entityDecorator = declaration && decorator(declaration, 'Entity');
    if (!declaration?.name || !entityDecorator) return undefined;
    const [options] = entityDecorator.arguments;
    const name = options && ts.isStringLiteral(options) ? options : property(options, 'name');
    if (name && ts.isStringLiteral(name)) return name.text;
    return declaration.name.text.replace(/(?<!^)([A-Z])/g, '_$1').toLowerCase();
  }

  // Nest's built-in HTTP exceptions, with the status they send.
  private httpError(expression: ts.Expression): { status: number; text: string } | undefined {
    if (!ts.isNewExpression(expression)) return undefined;
    if (packageOf(declarationOf(this.checker, expression.expression)) !== '@nestjs/common') {
      return undefined;
    }
    const exception = (nestCommon as Record<string, unknown>)[expression.expression.getText()];
    if (
      typeof exception !== 'function' ||
      !(exception.prototype instanceof nestCommon.HttpException)
    ) {
      return undefined;
    }
    const status = new (exception as new () => nestCommon.HttpException)().getStatus();
    return { status, text: message(expression.arguments?.[0]) ?? STATUS_CODES[status] ?? '' };
  }
}

interface Context {
  checker: ts.TypeChecker;
  classes: Map<string, ts.ClassDeclaration>;
  globalGuards: string[];
  globalPipes: string[];
}

function createContext(program: ts.Program): Context {
  const checker = program.getTypeChecker();
  const globalGuards = readModules(program).flatMap((module) =>
    module.providers.filter((p) => p.token === 'APP_GUARD').map((p) => p.name),
  );
  const globalPipes: string[] = [];
  for (const file of ownSourceFiles(program)) {
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const name = node.expression.name.text;
        const list =
          name === 'useGlobalGuards' ? globalGuards : name === 'useGlobalPipes' ? globalPipes : [];
        list.push(...node.arguments.map((argument) => instanceType(checker, argument)));
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return { checker, classes: ownClasses(program), globalGuards, globalPipes };
}

// A global guard is skipped for handlers marked with a decorator that sets metadata the guard
// reads: @Public() sets IS_PUBLIC_KEY, which JwtAuthGuard checks.
function isSkipped(context: Context, guard: string, targets: ts.Node[]): boolean {
  const declaration = context.classes.get(guard);
  if (!declaration) return false;
  const read = new Set<ts.Node>();
  const collect = (node: ts.Node) => {
    if (ts.isIdentifier(node)) {
      const target = declarationOf(context.checker, node);
      if (target) read.add(target);
    }
    ts.forEachChild(node, collect);
  };
  collect(declaration);

  let skipped = false;
  const find = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText() === 'SetMetadata' &&
      node.arguments[1]?.kind === ts.SyntaxKind.TrueKeyword
    ) {
      const key = declarationOf(context.checker, node.arguments[0]);
      if (key && read.has(key)) skipped = true;
    }
    ts.forEachChild(node, find);
  };
  for (const target of targets) {
    for (const { expression } of decorators(target)) {
      if (!ts.isCallExpression(expression)) continue;
      const factory = declarationOf(context.checker, expression.expression);
      if (factory && isOwnDeclaration(factory)) find(factory);
    }
  }
  return skipped;
}

function guardsFor(
  context: Context,
  controller: ts.ClassDeclaration,
  handler: ts.MethodDeclaration,
): string[] {
  const guards = context.globalGuards.filter(
    (guard) => !isSkipped(context, guard, [handler, controller]),
  );
  for (const target of [controller, handler]) {
    for (const argument of decorator(target, 'UseGuards')?.arguments ?? []) {
      // AuthGuard('jwt') returns a class, which is best named by the call.
      guards.push(
        ts.isCallExpression(argument) ? argument.getText() : className(context, argument),
      );
    }
  }
  return guards;
}

// `class JwtAuthGuard extends AuthGuard('jwt')` -> the strategy class registered as 'jwt'.
function passportStrategy(
  context: Context,
  guard: ts.ClassDeclaration,
): ts.ClassDeclaration | undefined {
  const base = guard.heritageClauses?.[0]?.types[0]?.expression;
  if (!base || !ts.isCallExpression(base) || base.expression.getText() !== 'AuthGuard') {
    return undefined;
  }
  const [name] = base.arguments;
  const strategies = [...context.classes.values()].filter((declaration) => {
    const parent = declaration.heritageClauses?.[0]?.types[0]?.expression;
    return (
      parent && ts.isCallExpression(parent) && parent.expression.getText() === 'PassportStrategy'
    );
  });
  return (
    strategies.find((strategy) => {
      const call = strategy.heritageClauses?.[0]?.types[0]?.expression as ts.CallExpression;
      return name && call.arguments[1]?.getText() === name.getText();
    }) ?? (strategies.length === 1 ? strategies[0] : undefined)
  );
}

// The class a guard or pipe argument makes, without type arguments: DefaultValuePipe, not
// DefaultValuePipe<any, number>.
const className = (context: Context, argument: ts.Expression): string =>
  instanceType(context.checker, argument).replace(/<.*>$/, '');

interface Stage {
  id: string;
  // Text on the arrow into the stage.
  input: string;
  steps: Step[];
}

function pipesFor(
  context: Context,
  parameter: ts.ParameterDeclaration,
): { pipe: string; input: string }[] {
  const { checker } = context;
  for (const [name, location] of [
    ['Body', 'body'],
    ['Query', 'query'],
    ['Param', 'param'],
  ]) {
    const call = decorator(parameter, name);
    if (!call) continue;
    const type = checker.getTypeAtLocation(parameter);
    const isClass = (type.getSymbol()?.flags ?? 0) & ts.SymbolFlags.Class;
    const [first] = call.arguments;
    const key = first && ts.isStringLiteral(first) ? first.text : undefined;
    const pipes = key === undefined ? call.arguments : call.arguments.slice(1);
    const input = `${location} ${isClass ? checker.typeToString(type) : (key ?? parameter.name.getText())}`;
    // ValidationPipe only validates class types, so it lets `@Param('id') id: string` through.
    return [
      ...context.globalPipes.filter((pipe) => isClass || pipe !== 'ValidationPipe'),
      ...pipes.map((pipe) => className(context, pipe)),
    ].map((pipe) => ({ pipe, input }));
  }
  return [];
}

function rejection(stage: string, status: number, when: string): Step {
  return block('opt', {
    label: when,
    steps: [{ kind: 'error', from: stage, status, text: STATUS_CODES[status] ?? '' }],
  });
}

function stagesFor(
  context: Context,
  tracer: Tracer,
  operation: Operation,
  controller: ts.ClassDeclaration,
  handler: ts.MethodDeclaration,
): Stage[] {
  const request = `${operation.method} ${operation.path}`;
  // The documented response for a status: "Missing, invalid or expired token."
  const documented = (status: number, fallback: string) => {
    const response = operation.operation.responses[String(status)] as ResponseObject | undefined;
    return response?.description?.replace(/\.$/, '') || fallback;
  };

  const stages: Stage[] = [];
  for (const guard of guardsFor(context, controller, handler)) {
    const declaration = context.classes.get(guard);
    const strategy = declaration && passportStrategy(context, declaration);
    const id = tracer.participant(
      guard,
      strategy?.name ? `${guard} (${strategy.name.text})` : guard,
    );
    const steps: Step[] = [];
    if (!declaration) {
      const status = LIBRARY_GUARD_STATUS[guard.replace(/\(.*$/, '')] ?? 403;
      steps.push(rejection(id, status, documented(status, 'rejected')));
    } else if (strategy) {
      const parent = strategy.heritageClauses?.[0]?.types[0]?.expression as ts.CallExpression;
      const library = packageOf(declarationOf(context.checker, parent.arguments[0]));
      const hook = (owner: ts.ClassDeclaration, name: string, label: string): Step[] => {
        const declared = method(owner, name);
        if (!declared) return [];
        const parameters = declared.parameters.map((p) => p.name.getText()).join(', ');
        return [
          { kind: 'self', on: id, text: `${label}(${parameters})` },
          ...tracer.body(declared, { participant: id }),
        ];
      };
      steps.push({
        kind: 'self',
        on: id,
        text: `${library ?? 'passport'} authenticates the request`,
      });
      // The strategy's validate() runs only once passport has authenticated the request (a
      // missing or expired token never reaches it). The guard's handleRequest() runs either way.
      const validate = hook(strategy, 'validate', `${strategy.name?.text}.validate`);
      if (validate.length > 0)
        steps.push(block('opt', { label: 'authenticated', steps: validate }));
      steps.push(...hook(declaration, 'handleRequest', 'handleRequest'));
    } else {
      const canActivate = method(declaration, 'canActivate');
      if (canActivate) steps.push(...tracer.body(canActivate, { participant: id }));
    }
    stages.push({ id, input: request, steps });
  }
  for (const parameter of handler.parameters) {
    for (const { pipe, input } of pipesFor(context, parameter)) {
      const id = tracer.participant(pipe);
      const steps = PIPES_THAT_NEVER_REJECT.has(pipe)
        ? []
        : [rejection(id, 400, documented(400, 'invalid'))];
      stages.push({ id, input, steps });
    }
  }
  return stages;
}

function traceOperation(context: Context, operation: Operation): Section {
  const heading = `${operation.method} ${operation.path}`;
  const [className, methodName] = (operation.operation.operationId ?? '').split('_');
  const controller = context.classes.get(className);
  const handler = controller && method(controller, methodName);
  if (!controller || !handler) {
    throw new Error(
      `No controller method for ${heading} (operationId ${operation.operation.operationId})`,
    );
  }

  const tracer = new Tracer(context.checker);
  tracer.participant(CLIENT);
  const steps: Step[] = [];
  let previous = CLIENT;
  for (const stage of stagesFor(context, tracer, operation, controller, handler)) {
    steps.push(
      { kind: 'message', from: previous, to: stage.id, text: stage.input },
      ...stage.steps,
    );
    previous = stage.id;
  }

  const id = tracer.participant(className);
  const response = handler.parameters.find((p) => decorator(p, 'Res') ?? decorator(p, 'Response'));
  const call = `${methodName}(${handler.parameters.map((p) => p.name.getText()).join(', ')})`;
  const success = successResponse(operation.operation);
  const body = success.schema ? schemaLabel(success.schema) : STATUS_CODES[Number(success.status)];
  steps.push({
    kind: 'call',
    from: previous,
    to: id,
    text: previous === CLIENT ? [heading, call] : call,
    steps: tracer.body(handler, { participant: id, response }),
    reply: `${success.status} ${body ?? ''}`,
    replyTo: CLIENT,
  });

  const lines = ['sequenceDiagram'];
  for (const [participant, label] of tracer.participants) {
    if (participant === CLIENT) lines.push(`  actor ${CLIENT}`);
    else if (participant !== DATABASE) {
      lines.push(
        `  participant ${participant}${label === participant ? '' : ` as ${escapeText(label)}`}`,
      );
    }
  }
  if (tracer.participants.has(DATABASE)) lines.push(`  participant ${DATABASE} as Database`);
  render(steps, '  ', lines);

  const file = path.relative(REPO_ROOT, controller.getSourceFile().fileName);
  return {
    heading,
    body: [`Handled by \`${className}.${methodName}\` in \`${file}\`.`, mermaid(lines)].join(
      '\n\n',
    ),
  };
}

const show = (text: Text): string =>
  (Array.isArray(text) ? text : [text]).map(escapeText).join('<br/>');

function render(steps: Step[], indent: string, lines: string[]): void {
  for (const step of steps) {
    if (step.kind === 'message') {
      lines.push(`${indent}${step.from}->>${step.to}: ${show(step.text)}`);
    } else if (step.kind === 'self') {
      lines.push(`${indent}${step.on}->>${step.on}: ${show(step.text)}`);
    } else if (step.kind === 'error') {
      lines.push(`${indent}${step.from}--x${CLIENT}: ${show(`${step.status} ${step.text}`)}`);
    } else if (step.kind === 'call') {
      lines.push(`${indent}${step.from}->>+${step.to}: ${show(step.text)}`);
      render(step.steps, indent, lines);
      lines.push(`${indent}${step.to}-->>-${step.replyTo ?? step.from}: ${show(step.reply)}`);
    } else {
      step.branches.forEach((branch, i) => {
        lines.push(`${indent}${i === 0 ? step.type : 'else'} ${show(branch.label)}`);
        render(branch.steps, `${indent}  `, lines);
      });
      lines.push(`${indent}end`);
    }
  }
}

export function sequenceDoc(program: ts.Program, document: OpenAPIObject): Doc {
  const context = createContext(program);
  return {
    file: 'sequence-diagrams.md',
    title: 'Sequence diagrams',
    intro:
      'One per endpoint, traced through the TypeScript source: the guards and pipes Nest runs ' +
      'first, then every call from the controller down to the database. Each branch in a ' +
      'guard, pipe or handler that ends in an HTTP error is drawn (arrows ending in x), not ' +
      'only the success path. Errors from before the guards, such as 415 for a body that ' +
      "isn't JSON, are left out.",
    sections: listOperations(document).map((operation) => traceOperation(context, operation)),
  };
}
