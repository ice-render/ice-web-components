import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import { terser } from 'rollup-plugin-terser';

const env = process.env.NODE_ENV;
const extensions = ['.js', '.jsx', '.ts', '.tsx'];
const external = ['ice-render'];
const globals = { 'ice-render': 'ICE' };

export default [
  {
    input: 'src/index.ts',
    external,
    output: {
      file: 'dist/index.cjs',
      format: 'cjs',
      globals,
    },
    plugins: [
      json(),
      nodeResolve({ extensions }),
      commonjs(),
      babel({ extensions, include: ['src/**/*'] }),
      env === 'production' && terser(),
    ].filter(Boolean),
  },
  {
    input: 'src/index.ts',
    external,
    output: {
      file: 'dist/index.mjs',
      format: 'esm',
      globals,
    },
    plugins: [
      json(),
      nodeResolve({ extensions }),
      commonjs(),
      babel({ extensions, include: ['src/**/*'] }),
      env === 'production' && terser(),
    ].filter(Boolean),
  },
  {
    input: 'src/index.ts',
    external,
    output: {
      name: 'ICEWEB',
      file: 'dist/index.umd.js',
      format: 'umd',
      globals,
    },
    plugins: [
      json(),
      nodeResolve({ extensions }),
      commonjs(),
      babel({ extensions, include: ['src/**/*'] }),
      env === 'production' && terser(),
    ].filter(Boolean),
  },
];
