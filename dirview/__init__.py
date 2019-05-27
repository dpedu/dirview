import os
import sys
# import locale
# locale.setlocale(locale.LC_ALL, 'en_US')
import logging
import cherrypy
from threading import Thread
from jinja2 import Environment, FileSystemLoader, select_autoescape
from dirview.dirtools import gen_db, gen_node_index, NodeType, NodeGroup
from dirview.utils import jinja_filters
from time import time
import json


APPROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../"))


class DbUpdater(Thread):
    def __init__(self, root_path, cache_dir):
        super().__init__()
        self.daemon = True
        self.root_path = root_path
        self.root = None
        self.index = None

    def run(self):
        start = time()
        logging.info("Generating database...")
        self.root = gen_db(self.root_path)
        logging.info("Generating index...")
        self.index = gen_node_index(self.root)
        logging.info("Warming caches...")
        self.root.total_size  # calculating these require recursing all nodes
        self.root.total_children
        logging.info(f"Database update complete in {round(time() - start, 3)}s")


class AppWeb(object):
    def __init__(self, database, template_dir):
        self.db = database
        self.tpl = Environment(loader=FileSystemLoader(template_dir),
                               autoescape=select_autoescape(['html', 'xml']))
        self.tpl.filters.update(**jinja_filters)

    def render(self, template, **kwargs):
        """
        Render a template
        """
        return self.tpl.get_template(template). \
            render(**kwargs,
                   NodeType=NodeType,
                   NodeGroup=NodeGroup) #, **self.get_default_vars())

    @cherrypy.expose
    def index(self, n=None):
        start = time()
        if self.db.root is None:
            return "I'm still scanning your files, check back soon."

        if n is None:
            node = self.db.root
        else:
            try:
                node = self.db.index[int(n)]
            except (ValueError, KeyError):
                raise cherrypy.HTTPError(404)

        page = self.render("page.html", node=node)
        dur = time() - start
        return page + f"\n<!-- render time: {round(dur, 4)} -->"

        # yield str(self.db.root)
        # yield "Ready<br />"
        # from time import time
        # start = time()
        # num_nodes = len([i for i in self.db.root.iter()])
        # dur = time() - start
        # yield f"num nodes: {num_nodes} in {round(dur, 3)}"

    @cherrypy.expose
    def chart_json(self, n, depth=2):
        # try:
        #     node = self.db.index[int(n)]
        # except (ValueError, KeyError):
        #     raise cherrypy.HTTPError(404)
        node = self.db.root

        data = AppWeb.export_children(node, depth=int(depth))

        cherrypy.response.headers["Content-type"] = "application/json"
        return json.dumps(data).encode("utf-8")

    @staticmethod
    def export_children(entry, depth):
        children = []
        if depth:
            for child in entry.children:
                child_data = AppWeb.export_children(child, depth - 1)
                if entry.total_size > 0:
                    child_data["weight"] = child_data["size"] / entry.total_size
                else:
                    child_data["weight"] = 0;
                children.append(child_data)
        children.sort(key=lambda c: c["size"],
                      reverse=True)

        return {"name": entry.name,
                "typ": entry.typ.value,
                "size": entry.total_size,
                "children": children}


def main():
    import argparse
    import signal

    parser = argparse.ArgumentParser(description="NAS storage visualizer")
    parser.add_argument('-d', '--dir', required=True, help="directory to scan")
    parser.add_argument('--cache', help="cache dir")
    parser.add_argument('-p', '--port', default=8080, type=int, help="http port to listen on")
    parser.add_argument('--debug', action="store_true", help="enable development options")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO if args.debug else logging.WARNING,
                        format="%(asctime)-15s %(levelname)-8s %(filename)s:%(lineno)d %(message)s")

    tpl_dir = os.path.join(APPROOT, "templates") if not args.debug else "templates"
    db = DbUpdater(args.dir, args.cache)
    db.start()

    web = AppWeb(db, tpl_dir)

    cherrypy.tree.mount(web, '/',
                        {'/': {},
                         '/static': {"tools.staticdir.on": True,
                                     "tools.staticdir.dir": os.path.join(APPROOT, "static")},  # TODO non --debug path
                         # '/login': {'tools.auth_basic.on': True,
                         #           'tools.auth_basic.realm': 'webapp',
                         #           'tools.auth_basic.checkpassword': validate_password}})
                         })

    cherrypy.config.update({
        'tools.sessions.on': False,
        'request.show_tracebacks': True, #??
        'server.show_tracebacks': True,  #??
        'server.socket_port': args.port,
        'server.socket_host': '0.0.0.0',
        'server.thread_pool': 5,
        'engine.autoreload.on': args.debug,
        'log.screen': False, #??
    })

    def signal_handler(signum, stack):
        logging.critical('Got sig {}, exiting...'.format(signum))
        cherrypy.engine.exit()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # This is also the maximum nested directory depth supported
    sys.setrecursionlimit(1000)

    try:
        cherrypy.engine.start()
        cherrypy.engine.block()
    finally:
        logging.info("API has shut down")
        cherrypy.engine.exit()


if __name__ == '__main__':
    main()