import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { resetMockDb } from './mock-api';
import { server } from './server';

// findBy* and waitFor give up after 1 s by default, which a busy machine can exceed.
configure({ asyncUtilTimeout: 5000 });

// jsdom doesn't implement scrolling, and ScrollRestoration scrolls on every navigation.
window.scrollTo = () => {};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  resetMockDb();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
