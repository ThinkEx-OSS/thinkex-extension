import { describe, it, expect, beforeEach } from 'vitest';
import { setupCounter } from './counter';

describe('setupCounter', () => {
  let button: HTMLButtonElement;

  beforeEach(() => {
    button = document.createElement('button');
  });

  it('initializes with count 0', () => {
    setupCounter(button);
    expect(button.innerHTML).toBe('count is 0');
  });

  it('increments count on click', () => {
    setupCounter(button);
    button.click();
    expect(button.innerHTML).toBe('count is 1');
    button.click();
    expect(button.innerHTML).toBe('count is 2');
  });
});
