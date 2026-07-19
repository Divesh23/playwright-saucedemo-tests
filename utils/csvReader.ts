import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

interface Credentials{
    username:string,
    password:string,
    validitystatus:string,
    shouldRun:string
}

export function readCsvFile() {
  const csvFile = path.resolve(__dirname, '../test-data/credentials.csv');
  const fileContent = fs.readFileSync(csvFile, 'utf-8');

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  return records as Credentials[];
}
