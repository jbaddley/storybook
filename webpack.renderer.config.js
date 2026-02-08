const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === 'development';

  return {
    entry: './src/renderer/index.tsx',
    // Use 'web' target for dev to avoid Node.js externals issue with webpack-dev-server
    target: isDevelopment ? 'web' : 'electron-renderer',
    devtool: isDevelopment ? 'eval-source-map' : 'source-map',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          include: /src/,
          use: [{ loader: 'ts-loader' }]
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    output: {
      path: path.resolve(__dirname, 'dist/renderer'),
      filename: 'renderer.js',
      publicPath: isDevelopment ? '/' : './'
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      alias: {
        '@main': path.resolve(__dirname, 'src/main'),
        '@renderer': path.resolve(__dirname, 'src/renderer'),
        '@shared': path.resolve(__dirname, 'src/shared'),
        // Replace events module with polyfill for webpack-dev-server
        'events': require.resolve('./src/renderer/utils/events-polyfill.js')
      },
      fallback: {
        "fs": false,
        "path": false,
        "crypto": false,
        "stream": false,
        "util": false,
        "buffer": require.resolve('buffer/'),
        "events": require.resolve('./src/renderer/utils/events-polyfill.js')
      }
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html'
      }),
      // Polyfill for 'global' in browser context
      new webpack.ProvidePlugin({
        global: require.resolve('./src/renderer/utils/global-polyfill.js'),
        // Provide EventEmitter for webpack-dev-server
        'EventEmitter': [require.resolve('./src/renderer/utils/events-polyfill.js'), 'default']
      }),
      // Define process.env for webpack-dev-server
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isDevelopment ? 'development' : 'production')
      })
    ],
    devServer: {
      port: 4200,
      hot: false, // Disable HMR to avoid EventEmitter issues
      liveReload: true, // Use live reload instead
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      historyApiFallback: true,
      client: {
        webSocketURL: 'auto://0.0.0.0:0/ws',
        overlay: false // Disable overlay to avoid HMR code injection
      }
    }
  };
};

