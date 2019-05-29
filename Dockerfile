FROM ubuntu:disco

RUN apt-get update && \
    apt-get install -y python3-pip git

# RUN apt-get update && \
#     apt-get install -y python3 git wget && \
#     wget -q -O /tmp/get-pip.py https://bootstrap.pypa.io/get-pip.py && \
#     python3 /tmp/get-pip.py && \
#     rm /tmp/get-pip.py

ADD . /tmp/code

RUN cd /tmp/code && \
    pip3 install -r requirements.txt && \
    python3 setup.py install

ENTRYPOINT ["dirviewd"]
