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

# Railway bind-mounts the persistent volume at /var/opt/mssql at runtime
# and the mount is owned by root, overlaying any build-time chown. The
# entrypoint chowns the mount before dropping to the mssql user.
COPY infra/mssql/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Stay as root so the entrypoint can chown the bind-mount; it drops to
# mssql via setpriv before exec'ing sqlservr.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
