//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');
const packageJson = require('../package.json');

// The release workflow passes the tag; a local build falls back to the package version.
const buildVersion = process.env.BUILD_VERSION || packageJson.version;

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node',
  mode: 'production',

  entry: './src/mcp/main.ts',
  output: {
    path: path.resolve(__dirname, '..', 'dist'),
    filename: 'mcp-server.js',
    libraryTarget: 'commonjs2'
  },
  // A leftover `require("vscode")` must fail at require time instead of resolving to an empty
  // object, which would silently hide broken behaviour.
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      __BUILD_VERSION__: JSON.stringify(buildVersion)
    }),
    new webpack.BannerPlugin({
      banner: '#!/usr/bin/env node',
      raw: true,
      entryOnly: true
    })
  ],
  optimization: {
    minimize: true
  }
};

module.exports = config;
