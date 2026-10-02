import { MalfunctionError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';
import { z } from 'zod';

import { asOutputFromContent } from './asOutputFromContent';

describe('asOutputFromContent', () => {
  given('[case1] z.string() schema', () => {
    const schema = z.string();

    when('[t0] content is plain text', () => {
      then('parses directly', () => {
        const result = asOutputFromContent({
          content: 'hello world',
          schema,
        });
        expect(result).toEqual('hello world');
      });
    });

    when('[t1] content is JSON string', () => {
      then('returns raw content (not JSON parsed)', () => {
        const result = asOutputFromContent({
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
        const result = asOutputFromContent({
          content: 'hello world',
          schema,
        });
        expect(result).toEqual('hello world');
      });
    });

    when('[t1] content is "null" string', () => {
      then('returns "null" as string (not parsed)', () => {
        const result = asOutputFromContent({
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
        const result = asOutputFromContent({
          content: '42',
          schema,
        });
        expect(result).toEqual(42);
      });
    });

    when('[t1] content is decimal', () => {
      then('parses as float', () => {
        const result = asOutputFromContent({
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
        const result = asOutputFromContent({
          content: '{"content":"hello"}',
          schema,
        });
        expect(result).toEqual({ content: 'hello' });
      });
    });

    when('[t1] content is invalid JSON', () => {
      then(
        'throws a MalfunctionError that names the reply, not a bare SyntaxError',
        async () => {
          const error = await getError(() =>
            asOutputFromContent({ content: 'not json', schema }),
          );
          expect(error).toBeInstanceOf(MalfunctionError);
          expect(error.message).toContain('the reply is not valid json');
          expect(error.message).toContain('"contentHead": "not json"');
          expect(error.message).toMatchSnapshot();
        },
      );
    });

    when('[t3] content is empty — a reply that came back with naught', () => {
      then('throws a MalfunctionError that names the empty reply', async () => {
        const error = await getError(() =>
          asOutputFromContent({ content: '', schema }),
        );
        expect(error).toBeInstanceOf(MalfunctionError);
        expect(error.message).toContain('"contentLength": 0');
        expect(error.message).toMatchSnapshot();
      });
    });

    when('[t2] content is valid JSON but wrong shape', () => {
      then('throws ZodError', () => {
        expect(() =>
          asOutputFromContent({
            content: '{"wrong":"field"}',
            schema,
          }),
        ).toThrow();
      });
    });
  });
});
