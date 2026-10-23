import { describe, it, expect } from 'vitest';
import { parseBatchBeerJson } from './batchBeerParser';

describe('batchBeerParser', () => {
  it('parses valid beer records with percentage strings', () => {
    const json = JSON.stringify([
      {
        name: 'Northern Monk Faith',
        brewery: 'Northern Monk Brew Co',
        location: 'Leeds',
        abv: '5.4%',
        style: 'Hazy Pale Ale',
        description: 'Juicy tropical pale ale.',
        type: 'Cask',
        isVegan: true,
        caskOrKeg: 'Keg',
      },
    ]);

    const result = parseBatchBeerJson(json);
    expect(result.error).toBeUndefined();
    expect(result.validDrinks).toHaveLength(1);
    expect(result.skippedCount).toBe(0);
    expect(result.validDrinks[0]).toMatchObject({
      name: 'Northern Monk Faith',
      brewery: 'Northern Monk Brew Co',
      location: 'Leeds',
      abv: '5.4%',
      style: 'Hazy Pale Ale',
      description: 'Juicy tropical pale ale.',
      type: 'Cask',
      isVegan: true,
      caskOrKeg: 'Keg',
    });
  });

  it('normalizes numeric ABV values by appending %', () => {
    const json = JSON.stringify([
      {
        name: 'Session Ale',
        brewery: 'Craft Co',
        location: 'Sheffield',
        abv: 3.8,
        style: 'Pale Ale',
        description: 'Crisp and refreshing.',
      },
    ]);

    const result = parseBatchBeerJson(json);
    expect(result.error).toBeUndefined();
    expect(result.validDrinks).toHaveLength(1);
    expect(result.validDrinks[0].abv).toBe('3.8%');
  });

  it('skips malformed records missing mandatory keys and tracks skippedCount', () => {
    const json = JSON.stringify([
      {
        name: 'Valid Beer',
        brewery: 'Brewery A',
        location: 'York',
        abv: '5.0%',
        style: 'IPA',
        description: 'Great IPA',
      },
      {
        name: 'Missing Style and ABV',
        brewery: 'Brewery B',
        location: 'Manchester',
        description: 'Incomplete record',
      },
      {
        name: 'Missing Description',
        brewery: 'Brewery C',
        location: 'Leeds',
        abv: '4.5%',
        style: 'Stout',
      },
    ]);

    const result = parseBatchBeerJson(json);
    expect(result.error).toBeUndefined();
    expect(result.validDrinks).toHaveLength(1);
    expect(result.skippedCount).toBe(2);
    expect(result.validDrinks[0].name).toBe('Valid Beer');
  });

  it('returns error when JSON root is not an array', () => {
    const json = JSON.stringify({ name: 'Not an array' });
    const result = parseBatchBeerJson(json);
    expect(result.validDrinks).toHaveLength(0);
    expect(result.error).toContain('JSON root must be an array');
  });

  it('returns error when array is empty', () => {
    const result = parseBatchBeerJson('[]');
    expect(result.validDrinks).toHaveLength(0);
    expect(result.error).toContain('empty array');
  });

  it('returns error when JSON syntax is invalid', () => {
    const result = parseBatchBeerJson('{ bad: json');
    expect(result.validDrinks).toHaveLength(0);
    expect(result.error).toContain('Invalid JSON file');
  });
});
