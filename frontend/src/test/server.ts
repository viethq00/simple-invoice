import { setupServer } from 'msw/node';
import { handlers } from './mock-api';

export const server = setupServer(...handlers);
