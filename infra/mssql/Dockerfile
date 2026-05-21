FROM mcr.microsoft.com/mssql/server:2022-latest

USER root

# SQL Server's bootstrap on Linux tries to create several directories at
# the filesystem root (/.system, /log, /data, /secrets) before it switches
# to the configured data path under /var/opt/mssql. On Railway's bind-mount
# runtime the non-root mssql user (UID 10001) can't write to /, so we
# pre-create everything at build time as root and hand ownership over.
RUN mkdir -p /.system /log /data /secrets /backup \
    && chown mssql:mssql /.system /log /data /secrets /backup \
    && chmod 770 /.system /log /data /secrets /backup

USER mssql
