const webpackConfig = require('./webpack.config.js');

module.exports = function(grunt) {
  grunt.initConfig({
    webpack: {
      dev: webpackConfig,
    },

    babel: {
      options: {
        sourceMap: true
      },
      dist: {
        files: {
          "static/scripts.js": "static/scripts.jsx"
        }
      }
    },
    less: {
      styles: {
        files: {
          "static/style.css": "assets/style/main.less"
        },
        sourceMap: true
      }
    },
    watch: {
      jshits: {
        files: ['assets/js/*.js'],
        tasks: ['webpack:dev', 'babel'],
      },
      cshits: {
        files: ["assets/style/main.less"],
        tasks: ['less:styles'],
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-webpack');
  grunt.loadNpmTasks('grunt-babel');
  grunt.loadNpmTasks('grunt-contrib-less');

  grunt.registerTask('default', ['webpack:dev', 'babel', 'less:styles']);
};
