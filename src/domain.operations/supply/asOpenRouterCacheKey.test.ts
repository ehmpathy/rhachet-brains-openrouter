import { asOpenRouterCacheKey } from './asOpenRouterCacheKey';

describe('asOpenRouterCacheKey', () => {
  test('one read for one model always yields one key', () => {
    expect(
      asOpenRouterCacheKey({ read: 'endpoints', model: 'z-ai/glm-5.3' }),
    ).toEqual(
      asOpenRouterCacheKey({ read: 'endpoints', model: 'z-ai/glm-5.3' }),
    );
  });

  test('two models yield two keys', () => {
    expect(
      asOpenRouterCacheKey({ read: 'endpoints', model: 'z-ai/glm-5.3' }),
    ).not.toEqual(
      asOpenRouterCacheKey({ read: 'endpoints', model: 'z-ai/glm-5.3-flash' }),
    );
  });

  test('two reads yield two keys', () => {
    expect(asOpenRouterCacheKey({ read: 'zdr', model: null })).not.toEqual(
      asOpenRouterCacheKey({ read: 'catalog', model: null }),
    );
  });

  test('the key is safe as a file name and names the read', () => {
    const key = asOpenRouterCacheKey({ read: 'endpoints', model: 'a/b' });
    expect(key).not.toContain('/');
    expect(key).toContain('openrouter.endpoints');
    expect(key).toMatchSnapshot();
  });
});
