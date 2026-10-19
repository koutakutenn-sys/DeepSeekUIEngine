import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no layout observer; real resize delivery is covered by browser tests.
globalThis.ResizeObserver = class implements ResizeObserver {
  observe() {} unobserve() {} disconnect() {}
};

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});
