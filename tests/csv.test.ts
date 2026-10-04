import { describe, expect, it } from 'vitest';
import { serializeCSV } from '../src/lib/utils';

describe('CSV serialization', () => {
  it('quotes and escapes every field, including commas and quotes', () => {
    expect(serializeCSV(['Category'], [['Paper, A4 "Premium"']])).toBe(
      '"Category"\r\n"Paper, A4 ""Premium"""'
    );
  });

  it('neutralizes spreadsheet formulas in text fields', () => {
    expect(serializeCSV(['Raw Text'], [['=SUM(1,2)'], ['  @cmd']])).toBe(
      '"Raw Text"\r\n"\'=SUM(1,2)"\r\n"\'  @cmd"'
    );
  });

  it('leaves numeric values numeric', () => {
    expect(serializeCSV(['Amount'], [[-1250]])).toBe('"Amount"\r\n"-1250"');
  });
});