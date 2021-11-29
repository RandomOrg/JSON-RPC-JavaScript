import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import ignore from 'rollup-plugin-ignore';
import { terser } from 'rollup-plugin-terser';
import stripCode from 'rollup-plugin-strip-code';

let basicPlugins = [
    stripCode({
        start_comment: 'node-import',
        end_comment: 'end-node-import'
    }),
    ignore(['xmlhttprequest']),
    resolve({
        jsnext: true,
        main: true,
        browser: true,
    }),
    commonjs({
        include: './lib/*',
        exclude: './lib/*//*'
    })
];

let minifyPlugin = terser({
    mangle: {
        reserved: ['XMLHttpRequest']
    }
});

export default args => {
    let output = [];
    let plugins = basicPlugins;
    plugins.push(args.minify ? minifyPlugin : []);
    let extension = args.minify ? '.min' : '';
    if (args.mode === 'browser') {
        output.push({
            input: './lib/esm/index.js',    
            output: [
                {
                    // IIFE for use in browsers
                    name: 'RandomOrgCore',
                    file: './lib/bundles/rdocore.iife' + extension + '.js',
                    format: 'iife',
                    sourcemap: 'inline'
                },
                {
                    // ES module for use in browsers
                    file: './lib/bundles/rdocore.es' + extension + '.js',
                    format: 'es',
                    exports: 'named',
                    sourcemap: 'inline'
                }
            ],
            plugins: plugins
        });
    }

    if (args.mode === 'test') {
        plugins.push(terser({
            compress: {
                conditionals: false
            },
            mangle: {
                reserved: ['XMLHttpRequest']
            }
        }));
        output.push({
            // Converting the tests to run in the browser
            input: './test/test.js',
            output: {
                file: './test/test.bundle.js',
                format: 'es',
                exports: 'named',
                sourcemap: 'inline'
            },
            treeshake: false,
            plugins: plugins
        });
    }

    return output;
};