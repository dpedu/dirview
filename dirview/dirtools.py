#!/usr/bin/env python3

"""
Generate an index of a file tree
"""


import os
import sys
from enum import Enum, auto
from dataclasses import dataclass
from time import time
import json
import resource
import typing
import logging
# import ipdb


class NodeType(Enum):
    DIR = auto()
    FILE = auto()
    ROOT = auto()  # behaves like a dir but has special handling in some places
    LINK = auto()
    SPECIAL = auto()


class NodeGroup(object):
    DIRLIKE = {NodeType.DIR, NodeType.ROOT}
    FILELIKE = {NodeType.FILE, NodeType.LINK, NodeType.SPECIAL}


# this costs about 380 bytes per file/directory
@dataclass
class Node:
    name: str
    typ: int
    children: list
    size: int
    parent: "Node"

    total_size_cache: int = None

    @property
    def total_size(self) -> int:
        if self.total_size_cache is None:
            if self.typ in {NodeType.DIR, NodeType.ROOT}:
                self.total_size_cache = sum([node.total_size for node in self.children])
            else:
                self.total_size_cache = self.size
        return self.total_size_cache

    total_children_cache: int = None

    @property
    def total_children(self) -> int:
        if self.total_children_cache is None:
            self.total_children_cache = sum([c.total_children for c in self.children]) + len(self.children)
        return self.total_children_cache

    def serialize(self) -> tuple:
        """
        Return a dictionary representation of the node suitable for plain text serialization such as json.

        Note that we could recurse here and nest children within this object as they are in the actual node, but that
        would require that the resulting json blob be loaded in one go.
        """
        return dict(name=self.name,
                    typ=self.typ.value,
                    children=[id(n) for n in self.children],
                    size=self.size,
                    parent=id(self.parent),
                    id=id(self))

    def iter(self, include_self=True) -> typing.Generator["Node", None, None]:
        """
        iterate the subtree this node is the root of
        """
        if include_self:
            yield self
        for child in self.children:
            yield from child.iter()

    @property
    def path(self):
        parts = [self.name]
        while True:
            if self.parent is None:
                break
            parts.insert(0, self.parent.name)
            self = self.parent
        return parts

    def __hash__(self):
        return id(self)

    # def __str__(self):  # TODO, because the default str() shows all the children recursively
    #     pass


def get_type(dirpath):
    if os.path.isdir(dirpath):
        return NodeType.DIR
    elif os.path.islink(dirpath):
        return NodeType.LINK
    elif os.path.isfile(dirpath):
        return NodeType.FILE

    return NodeType.SPECIAL
    # TODO other types


def gen_db_recurse(dirpath, parent=None, is_root=False):
    """
    returns a node representing the file/directory at dirpath
    :param dirpath: absolute path to the item
    """

    children = []

    node = Node(name=dirpath if is_root else os.path.basename(dirpath),
                typ=NodeType.ROOT if is_root else get_type(dirpath),
                children=children,
                size=0,
                parent=parent)

    if node.typ in {NodeType.FILE}:  # todo account for link and dir sizes somewhere
        node.size = os.path.getsize(dirpath)

    if os.path.isdir(dirpath) and not os.path.islink(dirpath):
        flist = []
        try:
            flist = os.listdir(dirpath)
        except PermissionError as e:
            logging.info(f"Could not access {dirpath}: {e}")
        for i in flist: # TODO we could probably parallelize the recursion down different trees?
            children.append(gen_db_recurse(os.path.join(dirpath, i), parent=node))

    return node


def gen_db(root):
    database = gen_db_recurse(root, is_root=True)

    return database


def print_db(node, indents=0):
    indent = "\t" * indents
    print(f"{indent}{node.name}: {node.typ}: {node.total_size()}b")
    for item in node.children:
        print_db(item, indents + 1)


def serialize_db(db):
    """
    Yield a stream of strings that contain a serialized copy of the database. The serialized format is newline separated
    json objects. Example directory tree:

    root_dir/hello.txt
    root_dir/foo/bar.txt

    This would be serialized as:

    {"name": "root_dir", "typ": 3, "children": [1, 2], "size": 0, "parent": null, "id": 0}
    {"name": "hello.txt", "typ": 2, "children": [], "size": 92863, "parent": 0, "id": 1}
    {"name": "foo", "typ": 1, "children": [3], "size": 0, "parent": 0, "id": 2}
    {"name": "bar.txt", "typ": 2, "children": [], "size": 19459, "parent": 2, "id": 3}

    Note that:
    - parent is null on the root node
    - child/parent relationships are by node id
    - it is possible to append entries to the dump at a later time
    - removing files directly from the serialized dump is technically possible
    """
    for node in db.iter():
        yield node.serialize()


def gen_node_index(db):
    index = {}
    for node in db.iter():
        index[id(node)] = node
    return index


def write_db(db, fobj):
    for ob in serialize_db(db):
        fobj.write(json.dumps(ob) + "\n")


def load_db(fpath):
    """
    Loading the db
    1) parse all node objects and save them in a cache keyed by the embedded IDs
    2) for each node in the cache:
        3) re-establish child/parent pointers

    Note that the cache is discarded and does NOT become the node id cache because it is keyed by the serialized IDs

    On my i7-7920HQ CPU @ 3.10GHz, loading a 276M dump with 2.2M lines takes 22s
    """
    nodecache = {}  # mapping of serialized_id->object
    root = None

    with open(fpath) as f:
        for line in f.readlines():
            info = json.loads(line)

            node = Node(name=info["name"],
                        typ=NodeType(info["typ"]),
                        children=info["children"],  # keep as IDs for now
                        size=info["size"],
                        parent=None)  # this could be 'nodecache[info["parent"]]' but that assumes the dump is in order

            nodecache[info["id"]] = node

            # if node.parent is None:
            #     root = node

    for oldid, node in nodecache.items():
        node.children = [nodecache[child_old_id] for child_old_id in node.children]
        if node.parent is not None:
            node.parent = nodecache[node.parent]

    return root


def test_gen_write_db(path):
    path = os.path.normpath(os.path.abspath(path))

    # start = time()
    before = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    db = gen_db(path)
    after = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    # print(f"recursed in {round(time()-start, 2)}s")
    # print_db(db)
    usage = after - before

    num_nodes = len([i for i in db.iter()])

    per_node = usage // num_nodes

    predict = 1000000

    print(f"allocated {round(usage/1024/1024, 2)} MB")
    print(f"tracking  {num_nodes} nodes")
    print(f"per node  {per_node} B")
    print(f"cost for {predict} nodes: {round(per_node*predict/1024/1024, 2)} MB")

    # import pdb
    # pdb.set_trace()

    # start = time()
    # sz = db.total_size()
    # print(f"total size: {sz}b")
    # print(f"total size: {round(sz/1000/1000/1000, 3)}gb")
    # print(f"calced size {round(time()-start, 2)}s")

    # start = time()
    # count = 0
    # for _ in recurse_nodes(db):
    #     count += 1
    # print(f"total nodes: {count}")
    # print(f"counted nodes size {round(time()-start, 2)}s")

    # nodecache = {}

    # with open("testdb.jsonl", "w") as f:
    #     write_db(db, f)

    # for node in recurse_nodes(db):
    #     print(node.name)
    # ipdb.set_trace()
    # pass


def test_load_db(fpath):
    print("ready")
    start = time()
    db = load_db(fpath)
    print(f"loaded database {round(time()-start, 2)}s")

    start = time()
    count = 0
    for n in db.iter():
        count += 1
    print(f"counted {count} nodes in {round(time()-start, 2)}s")

    start = time()
    index = gen_node_index(db)
    print(f"generated index with {len(index)} nodes in {round(time()-start, 2)}s")


def main(path):
    test_gen_write_db(path)
    # test_load_db(path)


if __name__ == '__main__':
    main(sys.argv[1])

"""
TODO:
- visualizer
- handling unaccounted space
    i.e. when dirs cant be scanned due to permission denied we'll see a difference between actual disk usage and our
    calculation. the difference can be treated as its own "unknown" cell
- add some sort of option to prevent scans from crossing mountpoints
- multiple roots
- list mode:
    - hide dot files
    - list subdirs first
- link to dir/file by permanent URL
    - we use id()s now
    - switch to path, finding a node by following the path through the database should be inexpensive

App planning:
- single page webui
    - probably a (sorted) table for now
    - shows a list of child nodes sorted by (recursive) size   (maybe we can precompute and cache top-level totals?)
        - children count is shown too
    - child nodes (that are directories) can be clicked on and the next page will show their children
    - child nodes (that are files) provide no interactivity
- the above should be a reasonable base for fancier visualization, a frontend piechart is trivial
    - a voronoi map would require recursing each child a few more levels doable.
- rescan / update
    - need to be able to rescan the filesystem (at interval or upon request)
        - Can we modify the tree in place?
        - Create a nodebypath function, retrieve a node reference based on a filesystem path
            - this should be useful when doing update scans
        - perhaps filesystem watches at a later point
"""
