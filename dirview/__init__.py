import os
import sys
import logging
import cherrypy
from threading import Thread
from jinja2 import Environment, FileSystemLoader, select_autoescape
from dirview.dirtools import gen_db, gen_node_index, node_by_path, NodeType, NodeGroup
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
                               autoescape=select_autoescape(["html", "xml"]))
        self.tpl.filters.update(**jinja_filters)

    def render(self, template, **kwargs):
        """
        Render a template
        """
        return self.tpl.get_template(template). \
            render(**kwargs,
                   NodeType=NodeType,
                   NodeGroup=NodeGroup)  #, **self.get_default_vars())

    def _cp_dispatch(self, vpath):
        return self.index

    @cherrypy.expose
    def index(self, *args, n=None):
        start = time()
        if self.db.root is None:
            return "I'm still scanning your files, check back soon."

        if n:
            try:
                node = self.db.index[int(n)]
            except KeyError:
                raise cherrypy.HTTPError(404)
            raise cherrypy.HTTPRedirect("/".join(node.path[1:]))
        else:
            path = cherrypy.request.path_info[1:].split("/")
            if path and path[0] == "":
                path = []  # :/
            node = node_by_path(self.db.root, path)
            if not node:
                raise cherrypy.HTTPError(404)

        page = self.render("page.html", node=node, root=self.db.root)
        dur = time() - start

        return page + f"\n<!-- render time: {round(dur, 4)} -->"

    @cherrypy.expose
    def chart_json(self, n, depth=2):
        start = time()
        try:
            node = self.db.index[int(n)]
        except (ValueError, KeyError):
            raise cherrypy.HTTPError(404)

        data = AppWeb.export_children(node, depth=int(depth))
        data["render_time"] = round(time() - start, 4)

        cherrypy.response.headers["Content-type"] = "application/json"
        return json.dumps(data).encode("utf-8")

    @staticmethod
    def export_children(entry, depth, min_children=25, max_children=50):
        """
        :param entry: node to recurse from. is included as the parent
        :param depth: how many layers to add under the parent node
        :param max_children: maximum number of children under a node, others are combined
        :param thresh: nodes smaller than this size will be combined into a group
        """
        children = []
        if depth:
            for child in entry.children:
                if child.total_size > 0:
                    children.append(AppWeb.export_children(child,
                                                           depth=depth - 1,
                                                           min_children=min_children,
                                                           max_children=max_children))

            children.sort(key=lambda c: c["value"],
                          reverse=True)

            # scan down the children until we've covered $thresh of the parent size
            thresh = 0.95    # The lower (1-$thresh) of nodes, sorted by size, will be combined into a group
            min_size = 100 / max_children / 100  # 50 max children means nodes under 2% max size must be combined
            child_sum = 0

            last_offset = 0
            for offset, child in enumerate(children):
                child_sum += child["value"]
                last_offset = offset
                if offset > max_children:
                    break  # max children
                    # continue  # min children
                if child["value"] / entry.total_size < min_size and offset > min_children:
                    break
                if child_sum / entry.total_size > thresh:
                    break

            others = children[last_offset + 1:]
            children = children[0:last_offset + 1]

            if others:
                other_sz = sum([i["value"] for i in others])
                other_children = sum([i["num_children"] for i in others])
                children.append({"id": id(others[0]),
                                 "name": f"({len(others)} others)",
                                 "typ": -1,
                                 "value": max(other_sz, 1),
                                 "children": [],
                                 "num_children": other_children,
                                 "total_children": child["total_children"],
                                 })

        return {"id": id(entry),
                "name": entry.name,
                "typ": entry.typ.value,
                "value": max(entry.total_size, 1),
                "children": children,
                "num_children": len(entry.children),
                "total_children": entry.total_children, }


def main():
    import argparse
    import signal

    parser = argparse.ArgumentParser(description="NAS storage visualizer")
    parser.add_argument("-d", "--dir", required=True, help="directory to scan")
    parser.add_argument("--cache", help="cache dir")
    parser.add_argument("-p", "--port", default=8080, type=int, help="http port to listen on")
    parser.add_argument("--debug", action="store_true", help="enable development options")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO if args.debug else logging.WARNING,
                        format="%(asctime)-15s %(levelname)-8s %(filename)s:%(lineno)d %(message)s")

    tpl_dir = os.path.join(APPROOT, "templates")
    db = DbUpdater(args.dir, args.cache)
    db.start()

    web = AppWeb(db, tpl_dir)

    cherrypy.tree.mount(web, "/",
                        {"/": {},
                         "/static": {"tools.staticdir.on": True,
                                     "tools.staticdir.dir": os.path.join(APPROOT, "static")},  # TODO non --debug path
                         # "/login": {"tools.auth_basic.on": True,
                         #           "tools.auth_basic.realm": "webapp",
                         #           "tools.auth_basic.checkpassword": validate_password}})
                         })

    cherrypy.config.update({
        "tools.sessions.on": False,
        "server.socket_host": "0.0.0.0",
        "server.socket_port": args.port,
        "server.thread_pool": 5,
        "engine.autoreload.on": args.debug
    })

    def signal_handler(signum, stack):
        logging.critical("Got sig {}, exiting...".format(signum))
        cherrypy.engine.exit()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # This is also the maximum nested directory depth supported
    sys.setrecursionlimit(1000)

    try:
        cherrypy.engine.start()
        cherrypy.engine.block()
    finally:
        cherrypy.engine.exit()


if __name__ == "__main__":
    main()