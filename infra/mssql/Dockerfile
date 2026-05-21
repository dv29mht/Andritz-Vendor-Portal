FROM mcr.microsoft.com/mssql/server:2022-latest

USER root

# SQL Server tries to create /.system at startup. On Railway's bind-mount
# runtime the non-root mssql user (UID 10001) can't write to /. Pre-create
# the directory at build time and hand it over so sqlservr finds it ready.
RUN mkdir -p /.system && chown mssql:mssql /.system && chmod 770 /.system

USER mssql
