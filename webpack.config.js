const path = require('path');
module.exports = {
  mode: 'development',
  entry: './assets/js/main.js',
  output: {
    path: path.resolve('static'),
    filename: 'scripts.js',
    libraryTarget: 'var',
    library: 'Application'
  },
  module: {
    /*loaders: [
      { test: /\.js$/, loader: 'babel-loader', exclude: /node_modules/ }
     ]*/
 }
}