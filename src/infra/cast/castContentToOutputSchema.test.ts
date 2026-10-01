import { given, then, when } from 'test-fns';
import { z } from 'zod';

import { castContentToOutputSchema } from './castContentToOutputSchema';

describe('castContentToOutputSchema', () => {
  given('[case1] z.string() schema', () => {
    const schema = z.string();

    when('[t0] content is plain text', () => {
      then('parses directly', () => {
        const result = castContentToOutputSchema({
          content: 'hello world',
          schema,
        });
        expect(result).toEqual('hello world');
      });
    });

    when('[t1] content is JSON string', () => {
      then('returns raw content (not JSON parsed)', () => {
        const result = castContentToOutputSchema({
          content: '"hello world"',
          schema,
        });
        expect(result).toEqual('"hello world"');
      });
    });
  });

  given('[case2] z.string().nullable() schema', () => {
    const schema = z.string().nullable();

    when('[t0] content is plain text', () => {
      then('parses directly', () => {
        const result = castContentToOutputSchema({
          content: 'hello world',
          schema,
        });
        expect(result).toEqual('hello world');
      });
    });

    when('[t1] content is "null" string', () => {
      then('returns "null" as string (not parsed)', () => {
        const result = castContentToOutputSchema({
          content: 'null',
          schema,
        });
        expect(result).toEqual('null');
      });
    });
  });

  given('[case3] z.number() schema', () => {
    const schema = z.number();

    when('[t0] content is JSON number', () => {
      then('parses as number', () => {
        const result = castContentToOutputSchema({
          content: '42',
          schema,
        });
        expect(result).toEqual(42);
      });
    });

    when('[t1] content is decimal', () => {
      then('parses as float', () => {
        const result = castContentToOutputSchema({
          content: '3.14159',
          schema,
        });
        expect(result).toEqual(3.14159);
      });
    });
  });

  given('[case4] z.object({ content: z.string() }) schema', () => {
    const schema = z.object({ content: z.string() });

    when('[t0] content is valid JSON object', () => {
      then('parses and validates', () => {
        const result = castContentToOutputSchema({
          content: '{"content":"hello"}',
          schema,
        });
        expect(result).toEqual({ content: 'hello' });
      });
    });

    when('[t1] content is invalid JSON', () => {
      then('throws SyntaxError', () => {
        expect(() =>
          castContentToOutputSchema({
            content: 'not json',
            schema,
          }),
        ).toThrow(SyntaxError);
      });
    });

    when('[t2] content is valid JSON but wrong shape', () => {
      then('throws ZodError', () => {
        expect(() =>
          castContentToOutputSchema({
            content: '{"wrong":"field"}',
            schema,
          }),
        ).toThrow();
      });
    });
  });
});
