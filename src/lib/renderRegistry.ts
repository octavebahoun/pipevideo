import { ChildProcess } from 'child_process';

const globalForRegistry = global as unknown as {
  activeRenders: Map<string, ChildProcess>;
};

export const activeRenders = globalForRegistry.activeRenders || new Map<string, ChildProcess>();

if (process.env.NODE_ENV !== 'production') {
  globalForRegistry.activeRenders = activeRenders;
}
