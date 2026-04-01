import { Command } from 'commander';

const { version: CLI_VERSION = '0.0.0' } = require('../package.json');

export const program = new Command();
export { CLI_VERSION };
