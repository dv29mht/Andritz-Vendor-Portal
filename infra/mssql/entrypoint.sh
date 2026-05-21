#!/bin/bash
# SQL Server 2022 runs as non-root user `mssql` (uid 10001) and on startup
# tries to mkdir several state directories at the filesystem root
# (/.system, /log, /data, /secrets) plus its data dir (/var/opt/mssql).
# On Railway:
#   1. The persistent volume bind-mounted at /var/opt/mssql is root-owned.
#   2. The rootfs overlay sometimes wipes the build-time chown of /.system
#      and friends so they come back as root-owned (or missing entirely).
# Both leave sqlservr unable to create the dirs it needs, and the container
# crash-loops with "LinuxDirectory.cpp:420 ... Permission denied".
#
# So we redo the mkdir + chown here at runtime as root, every boot, before
# dropping privileges. Idempotent — mkdir -p is a no-op if the dir exists.
set -e

mkdir -p /.system /log /data /secrets /backup \
         /var/opt/mssql/data \
         /var/opt/mssql/log \
         /var/opt/mssql/secrets \
         /var/opt/mssql/backup

chown -R mssql:root /.system /log /data /secrets /backup /var/opt/mssql
chmod -R 770       /.system /log /data /secrets /backup /var/opt/mssql

# Drop to the mssql user and start SQL Server. setpriv (not su) keeps the
# pid 1 process so Railway's SIGTERM on redeploys reaches sqlservr directly
# for a clean shutdown.
exec setpriv --reuid=mssql --regid=root --init-groups /opt/mssql/bin/sqlservr
