#!/usr/bin/env node
import { executar } from '../src/cli.mjs';

process.exitCode = executar(process.argv.slice(2));
