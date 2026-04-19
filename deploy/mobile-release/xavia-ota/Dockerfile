FROM xaviaio/xavia-ota:latest

COPY patch-api-bundles.js /tmp/patch-api-bundles.js

RUN node /tmp/patch-api-bundles.js && rm /tmp/patch-api-bundles.js
