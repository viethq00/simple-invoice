import { z } from 'zod';

// The CSP has no 'unsafe-eval'. Without this, Zod probes `new Function` when a schema is
// created, and Firefox reports the blocked probe as a console error.
z.config({ jitless: true });
