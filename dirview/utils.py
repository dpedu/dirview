import os


def data_calc_size(size):
    """
    Return a friendly data size unit and float tuple
    e.g.
        12345   -> 12.345 KB
        1234567 -> 1.235 MB
    """
    base = 1024
    progression = ["B", "KB", "MB", "GB", "TB", "PB"]  # ...
    unit = 0
    base_exponent = 0
    while True:
        calced = size / (base ** base_exponent)
        if calced < base:
            return (round(calced, 3), progression[unit], )
        else:
            base_exponent += 1
            unit += 1


def data_size_format(size):
    return "{} {}".format(*data_calc_size(size))


jinja_filters = dict(id=id,
                     repr=repr,
                     len=len,
                     pathjoin=lambda x: os.path.join(*x),
                     commafy=lambda x: format(x, ',d'),
                     data=data_size_format)
