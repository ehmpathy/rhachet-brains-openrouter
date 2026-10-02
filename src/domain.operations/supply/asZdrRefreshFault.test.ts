import { MalfunctionError } from 'helpful-errors';

import { asZdrRefreshFault } from './asZdrRefreshFault';

describe('asZdrRefreshFault', () => {
  test('a failed read is a warn, never a held defect', () => {
    const fault = asZdrRefreshFault({
      error: new MalfunctionError('openrouter read failed: 503'),
      ageMinutes: 90,
    });
    expect(fault.defect).toBeNull();
    expect(fault.warn).toContain('age 90 min');
    expect(fault.warn).toContain('openrouter read failed: 503');
    expect(fault.warn).toMatchSnapshot();
  });

  test('a TypeError is a defect held to be thrown, with its cause', () => {
    const cause = new TypeError('index.map is not a function');
    const fault = asZdrRefreshFault({ error: cause, ageMinutes: 90 });
    expect(fault.warn).toBeNull();
    expect(fault.defect).toBeInstanceOf(MalfunctionError);
    expect(fault.defect).toMatchObject({ cause });
    expect(fault.defect?.message).toMatchSnapshot();
  });

  test('a thrown non-error is still held as a defect', () => {
    const fault = asZdrRefreshFault({ error: 'bare string', ageMinutes: 5 });
    expect(fault.defect).toBeInstanceOf(MalfunctionError);
    expect(fault.defect).toMatchObject({ cause: { message: 'bare string' } });
  });
});
