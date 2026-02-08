const path = require('path');

module.exports = [
  {
    entry: './src/main/main.ts',
    target: 'electron-main',
    externals: {
      'electron-reloader': 'commonjs electron-reloader',
      'chokidar': 'commonjs chokidar',
      'fsevents': 'commonjs fsevents',
      '@prisma/client': 'commonjs @prisma/client',
      '.prisma/client': 'commonjs .prisma/client',
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          include: /src/,
          use: [{ loader: 'ts-loader' }]
        },
        {
          test: /\.node$/,
          loader: 'node-loader'
        }
      ]
    },
    output: {
      path: path.resolve(__dirname, 'dist/main'),
      filename: 'main.js'
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    node: {
      __dirname: false,
      __filename: false
    }
  },
  {
    entry: './src/main/preload.ts',
    target: 'electron-preload',
    module: {
      rules: [
        {
          test: /\.ts$/,
          include: /src/,
          use: [{ loader: 'ts-loader' }]
        }
      ]
    },
    output: {
      path: path.resolve(__dirname, 'dist/main'),
      filename: 'preload.js'
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    node: {
      __dirname: false,
      __filename: false
    }
  }
];

