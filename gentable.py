#!/usr/bin/env python3

"""
Generate a database of file tree sizes
aka tab-seperated file size and paths
"""


import os
import sys
from enum import Enum, auto
from dataclasses import dataclass
from time import time


class NodeType(Enum):
    DIR = auto()
    FILE = auto()
    ROOT = auto()
    # TODO use these
    LINK = auto()
    SPECIAL = auto()


@dataclass
class Node:
    name: str
    typ: int
    children: list
    size: int

    def total_size(self) -> int:
        if self.typ in {NodeType.DIR, NodeType.ROOT}:
            sz = 0
            for node in self.children:
                sz += node.total_size()
            return sz
        else:
            return self.size


def recurse_nodes(root):
    yield root
    for child in root.children:
        yield from recurse_nodes(child)


def get_type(dirpath):
    if os.path.isdir(dirpath):
        return NodeType.DIR
    elif os.path.islink(dirpath):
        return NodeType.LINK
    elif os.path.isfile(dirpath):
        return NodeType.FILE

    return NodeType.SPECIAL
    # TODO other types


def gen_db_recurse(dirpath, is_root=False):
    """
    returns a node representing the file/directory at dirpath
    :param dirpath: absolute path to the item
    """

    children = []

    node = Node(os.path.basename(dirpath),
                NodeType.ROOT if is_root else get_type(dirpath),
                children,
                0
                )
    if node.typ in {NodeType.FILE}:
        node.size = os.path.getsize(dirpath)

    if os.path.isdir(dirpath):
        for i in os.listdir(dirpath):
            children.append(gen_db_recurse(os.path.join(dirpath, i)))

    return node


def gen_db(root):
    database = gen_db_recurse(root, is_root=True)

    return database


def print_db(node, indents=0):
    indent = "\t" * indents
    print(f"{indent}{node.name}: {node.typ}: {node.total_size()}b")
    for item in node.children:
        print_db(item, indents + 1)


def main(path):
    import ipdb
    path = os.path.normpath(os.path.abspath(path))

    start = time()
    db = gen_db(path)
    print(f"recursed in {round(time()-start, 2)}s")
    # print_db(db)

    start = time()
    print(f"total size: {db.total_size()}b")
    print(f"calced size {round(time()-start, 2)}s")

    start = time()
    count = 0
    for _ in recurse_nodes(db):
        count += 1
    print(f"total nodes: {count}")
    print(f"counted nodes size {round(time()-start, 2)}s")

    # for node in recurse_nodes(db):
    #     print(node.name)
    ipdb.set_trace()
    pass


if __name__ == '__main__':
    main(sys.argv[1])
