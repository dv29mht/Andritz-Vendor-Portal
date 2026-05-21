#!/bin/bash
# Railway bind-mounts the persistent volume at /var/opt/mssql at runtime,
# and the mount is owned by root. SQL Server runs as the non-root mssql
# user (UID 10001) and can't create its data/log/secrets directories
# inside a root-owned mount. Fix that here, then start sqlservr.
set -e

mkdir -p /var/opt/mssql/data \
         /var/opt/mssql/log \
         /var/opt/mssql/secrets \
         /var/opt/mssql/backup
chown -R mssql:mssql /var/opt/mssql
chmod -R 770 /var/opt/mssql

# Drop to the mssql user and start SQL Server. We use `setpriv` rather
# than `su` so the user-id swap doesn't allocate a TTY or spawn a sub-
# shell that would complicate signal forwarding (Railway sends SIGTERM
# on redeploys; sqlservr must receive it directly to shut down cleanly).
exec setpriv --reuid=mssql --regid=mssql --init-groups /opt/mssql/bin/sqlservr
