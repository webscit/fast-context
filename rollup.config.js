/**
 * @license
 * Copyright 2023 Frederic Collonval
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {summary} from 'rollup-plugin-summary';
import {terser} from 'rollup-plugin-terser';
import copy from 'rollup-plugin-copy';
import nodeResolve from '@rollup/plugin-node-resolve';
import sourcemaps from 'rollup-plugin-sourcemaps';
import replace from '@rollup/plugin-replace';
import virtual from '@rollup/plugin-virtual';

// In CHECKSIZE mode we:
// 1) Don't emit any files.
// 2) Don't include copyright header comments.
// 3) Don't include the "//# sourceMappingURL" comment.
const CHECKSIZE = !!process.env.CHECKSIZE;
if (CHECKSIZE) {
  console.log('NOTE: In CHECKSIZE mode, no output!');
}

const skipBundleOutput = {
  generateBundle(options, bundles) {
    // Deleting all bundles from this object prevents them from being written,
    // see https://rollupjs.org/guide/en/#generatebundle.
    for (const name in bundles) {
      delete bundles[name];
    }
  },
};

const stableProperties = {};

const generateTerserOptions = () => ({
  warnings: true,
  ecma: 2021,
  compress: {
    unsafe: true,
    // An extra pass can squeeze out an extra byte or two.
    passes: 2,
  },
  output: {
    // "some" preserves @license and @preserve comments
    comments: CHECKSIZE ? false : 'some',
    inline_script: false,
  },
  mangle: {
    properties: {
      regex: /^_/,
      // Set to true to mangle to readable names
      debug: false,
    },
  },
});

const injectNodeDomShimIntoReactiveElement = [];

export function litProdConfig({
  entryPoints,
  external = [],
  bundled = [],
  outputDir = './',
  copyHtmlTests = true,
  includeNodeBuild = false,
  // eslint-disable-next-line no-undef
} = options) {
  const nameCacheSeederInfile = 'name-cache-seeder-virtual-input.js';
  const nameCacheSeederOutfile = 'name-cache-seeder-throwaway-output.js';
  const nameCacheSeederContents = [
    // Import every entry point so that we see all property accesses.
    // Give a unique named import to prevent duplicate identifier errors.
    ...entryPoints.map(
      (name, idx) => `import * as import${idx} from './development/${name}.js';`
    ),
    // Prevent tree shaking that occurs during mangling.
    ...entryPoints.map((_name, idx) => `console.log(import${idx});`),
  ].join('\n');
  const nameCacheSeederTerserOptions = generateTerserOptions();

  const terserOptions = generateTerserOptions();

  return [
    {
      input: nameCacheSeederInfile,
      output: {
        file: nameCacheSeederOutfile,
        format: 'esm',
      },
      external,
      // Since our virtual name cache seeder module doesn't export anything,
      // almost everything gets tree shaken out, and terser wouldn't see any
      // properties.
      treeshake: false,
      plugins: [
        virtual({
          [nameCacheSeederInfile]: nameCacheSeederContents,
        }),
        terser(nameCacheSeederTerserOptions),
        skipBundleOutput,
      ],
    },
    // Production build
    {
      input: entryPoints.map((name) => `development/${name}.js`),
      output: {
        dir: outputDir,
        format: 'esm',
        // Preserve existing module structure (e.g. preserve the "directives/"
        // directory).
        preserveModules: true,
        sourcemap: !CHECKSIZE,
      },
      external,
      plugins: [
        // Switch all DEV_MODE variable assignment values to false. Terser's dead
        // code removal will then remove any blocks that are conditioned on this
        // variable.
        //
        // Code in our development/ directory looks like this:
        //
        //   const DEV_MODE = true;
        //   if (DEV_MODE) { // dev mode stuff }
        //
        // Note we want the transformation to `goog.define` syntax for Closure
        // Compiler to be trivial, and that would look something like this:
        //
        //   const DEV_MODE = goog.define('lit-html.DEV_MODE', false);
        //
        // We can't use terser's compress.global_defs option, because it won't
        // replace the value of a variable that is already defined in scope (see
        // https://github.com/terser/terser#conditional-compilation). It seems to be
        // designed assuming that you are _always_ using terser to set the def one
        // way or another, so it's difficult to define a default in the source code
        // itself.
        replace({
          preventAssignment: true,
          values: {
            'const DEV_MODE = true': 'const DEV_MODE = false',
            'const ENABLE_EXTRA_SECURITY_HOOKS = true':
              'const ENABLE_EXTRA_SECURITY_HOOKS = false',
            'const ENABLE_SHADYDOM_NOPATCH = true':
              'const ENABLE_SHADYDOM_NOPATCH = false',
          },
        }),
        // This plugin automatically composes the existing TypeScript -> raw JS
        // sourcemap with the raw JS -> minified JS one that we're generating here.
        sourcemaps(),
        terser(terserOptions),
        summary({
          showBrotliSize: true,
          showGzippedSize: true,
        }),
        ...(CHECKSIZE ? [skipBundleOutput] : []),
        ...(copyHtmlTests && !CHECKSIZE
          ? [
              // Copy polyfill support tests.
              copy({
                targets: [
                  {
                    src: `src/test/*_test.html`,
                    dest: ['development/test/', 'test/'],
                  },
                  {
                    // TODO: use flatten: false when this is fixed
                    // https://github.com/vladshcherbin/rollup-plugin-copy/issues/37
                    src: `src/test/polyfill-support/*_test.html`,
                    dest: [
                      'development/test/polyfill-support',
                      'test/polyfill-support',
                    ],
                  },
                ],
              }),
            ]
          : []),
      ],
    },
    // Node build
    ...(includeNodeBuild
      ? [
          {
            input: entryPoints.map((name) => `development/${name}.js`),
            output: {
              dir: `${outputDir}/node`,
              format: 'esm',
              preserveModules: true,
              sourcemap: !CHECKSIZE,
            },
            external,
            plugins: [
              replace({
                preventAssignment: true,
                values: {
                  // Setting NODE_MODE to true enables node-specific behaviors,
                  // i.e. using globalThis instead of window, and shimming APIs
                  // needed for Lit bootup.
                  'const NODE_MODE = false': 'const NODE_MODE = true',
                  // Other variables should behave like prod mode.
                  'const DEV_MODE = true': 'const DEV_MODE = false',
                  'const ENABLE_EXTRA_SECURITY_HOOKS = true':
                    'const ENABLE_EXTRA_SECURITY_HOOKS = false',
                  'const ENABLE_SHADYDOM_NOPATCH = true':
                    'const ENABLE_SHADYDOM_NOPATCH = false',
                },
              }),
              ...injectNodeDomShimIntoReactiveElement,
              sourcemaps(),
              // We want the production Node build to be minified because:
              //
              // 1. It should be very slightly faster, even in Node where bytes
              //    are not as important as in the browser.
              //
              // 2. It means we don't need a Node build for lit-element. There
              //    is no Node-specific logic needed in lit-element. However,
              //    lit-element and reactive-element must be consistently
              //    minified or unminified together, because lit-element
              //    references properties from reactive-element which will
              //    otherwise have different names. The default export that
              //    lit-element will use is minified.
              terser(terserOptions),
              summary({
                showBrotliSize: true,
                showGzippedSize: true,
              }),
              ...(CHECKSIZE ? [skipBundleOutput] : []),
            ],
          },
          {
            // Also create a development Node build that does not minify to be
            // used during development so it can work along side the unminified
            // dev build of lit-element
            input: entryPoints.map((name) => `development/${name}.js`),
            output: {
              dir: `${outputDir}/node/development`,
              format: 'esm',
              preserveModules: true,
              sourcemap: !CHECKSIZE,
            },
            external,
            plugins: [
              replace({
                preventAssignment: true,
                values: {
                  // Setting NODE_MODE to true enables node-specific behaviors,
                  // i.e. using globalThis instead of window, and shimming APIs
                  // needed for Lit bootup.
                  'const NODE_MODE = false': 'const NODE_MODE = true',
                  'const ENABLE_SHADYDOM_NOPATCH = true':
                    'const ENABLE_SHADYDOM_NOPATCH = false',
                },
              }),
              ...injectNodeDomShimIntoReactiveElement,
              sourcemaps(),
              summary({
                showBrotliSize: true,
                showGzippedSize: true,
              }),
              ...(CHECKSIZE ? [skipBundleOutput] : []),
            ],
          },
        ]
      : []),
    // CDN bundles
    ...bundled.map(({file, output, name, format, sourcemapPathTransform}) =>
      litMonoBundleConfig({
        file,
        output,
        name,
        terserOptions,
        format,
        sourcemapPathTransform,
      })
    ),
  ];
}

const litMonoBundleConfig = ({
  file,
  output,
  name,
  terserOptions,
  format = 'umd',
  sourcemapPathTransform,
  // eslint-disable-next-line no-undef
} = options) => ({
  input: `development/${file}.js`,
  output: {
    file: `${output || file}.js`,
    format,
    name,
    sourcemap: !CHECKSIZE,
    sourcemapPathTransform,
  },
  plugins: [
    nodeResolve({
      // We want to resolve to development, because the default is production,
      // which is already rolled-up sources. That creates an unnecessary
      // dependency between rollup build steps, and causes double-minification.
      exportConditions: ['development'],
    }),
    replace({
      preventAssignment: true,
      values: {
        'const DEV_MODE = true': 'const DEV_MODE = false',
        'const ENABLE_EXTRA_SECURITY_HOOKS = true':
          'const ENABLE_EXTRA_SECURITY_HOOKS = false',
        'const ENABLE_SHADYDOM_NOPATCH = true':
          'const ENABLE_SHADYDOM_NOPATCH = false',
        // For downleveled ES5 build of polyfill-support
        'var DEV_MODE = true': 'var DEV_MODE = false',
        'var ENABLE_EXTRA_SECURITY_HOOKS = true':
          'var ENABLE_EXTRA_SECURITY_HOOKS = false',
        'var ENABLE_SHADYDOM_NOPATCH = true':
          'var ENABLE_SHADYDOM_NOPATCH = false',
      },
    }),
    // This plugin automatically composes the existing TypeScript -> raw JS
    // sourcemap with the raw JS -> minified JS one that we're generating here.
    sourcemaps(),
    terser(terserOptions),
    summary({
      showBrotliSize: true,
      showGzippedSize: true,
    }),
  ],
});

export default litProdConfig({
  entryPoints: ['index'],
  external: ['@microsoft/fast-element'],
});
