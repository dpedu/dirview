const path = require('path');
module.exports = {
  mode: 'development',
  entry: './assets/js/main.js',
  output: {
    path: path.resolve('static'),
    filename: 'scripts.jsx',
    libraryTarget: 'var',
    library: 'Application'
  },
  module: {
    // devtool: 'source-map'
    /*loaders: [
      { test: /\.js$/, loader: 'babel-loader', exclude: /node_modules/ }
     ]*/
 }
}