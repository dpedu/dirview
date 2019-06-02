const webpackConfig = require('./webpack.config.js');


module.exports = function(grunt) {
  grunt.initConfig({
    /*less: {
      website: {
        files: {
          'styles/css/main.css': 'styles/less/main.less'
        }
      }
    },*/
    /*cssmin: {
      website: {
        files: {
          'styles/mincss/pure.css': 'node_modules/purecss/build/pure.css',
          'styles/mincss/grids-responsive-min.css': 'node_modules/purecss/build/grids-responsive.css',
          'styles/mincss/main.css': 'styles/css/main.css'
        }
      }
    },*/
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
    /*concat: {
      deps_js: {
        src: [
          'node_modules/d3-voronoi-treemap/build/d3-voronoi-treemap.js',
          'node_modules/d3-voronoi-map/build/d3-voronoi-map.js',
          'node_modules/d3-weighted-voronoi/build/d3-weighted-voronoi.js',
          'node_modules/d3-scale/dist/d3-scale.js',
          'node_modules/d3/dist/d3.js',
          'node_modules/randomcolor/randomColor.js',
          'assets/js/main.js'
        ],
        dest: 'static/scripts.js',
      },
    },*/
    watch: {
      jshits: {
        files: ['assets/js/*.js'],
        tasks: ['webpack:dev', 'babel'],
        // options: {
        //   spawn: false
        // }
      },
      cshits: {
        files: ["assets/style/main.less"],
        tasks: ['less:styles'],
      }
    }
  });

  // grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-watch');
  // grunt.loadNpmTasks('grunt-contrib-cssmin');
  // grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-webpack');
  grunt.loadNpmTasks('grunt-babel');
  grunt.loadNpmTasks('grunt-contrib-less');

  // grunt.registerTask('default', ['less:website', 'cssmin:website', 'concat:dist']);
  grunt.registerTask('default', ['webpack:dev', 'babel', 'less:styles']);

};
