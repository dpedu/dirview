#!/usr/bin/env python3
from setuptools import setup

__version__ = "0.0.1"

setup(name='dirview',
      version=__version__,
      description='Storage visualizer',
      url='http://git.davepedu.com/dave/dirview',
      author='dpedu',
      author_email='dave@davepedu.com',
      packages=['dirview'],
      entry_points={
          "console_scripts": [
              "dirviewd = dirview:main"
          ]
      },
      package_data={'dirview': ['../templates/*.html',
                                '../static/scripts.js']},
      zip_safe=False)
