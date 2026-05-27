import {
  clearDictationOwner,
  getDictationOwner,
  setDictationOwner,
} from '../src/dictationOwner';

describe('dictationOwner', () => {
  beforeEach(() => {
    clearDictationOwner();
  });

  test('setDictationOwner and getDictationOwner track active owner', () => {
    const owner = { id: 'field-a' };
    setDictationOwner(owner);
    expect(getDictationOwner()).toBe(owner);
  });

  test('clearDictationOwner without arg clears any owner', () => {
    setDictationOwner({ id: 'field-a' });
    clearDictationOwner();
    expect(getDictationOwner()).toBeNull();
  });

  test('clearDictationOwner only clears matching owner', () => {
    const ownerA = { id: 'field-a' };
    const ownerB = { id: 'field-b' };
    setDictationOwner(ownerA);
    clearDictationOwner(ownerB);
    expect(getDictationOwner()).toBe(ownerA);
    clearDictationOwner(ownerA);
    expect(getDictationOwner()).toBeNull();
  });

  test('second owner replaces first until cleared', () => {
    setDictationOwner({ id: 'field-a' });
    setDictationOwner({ id: 'field-b' });
    expect(getDictationOwner()).toEqual({ id: 'field-b' });
  });
});
