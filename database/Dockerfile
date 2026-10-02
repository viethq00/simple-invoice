FROM postgres:17-alpine

COPY init-secrets.sh /usr/local/bin/
RUN chmod 0755 /usr/local/bin/init-secrets.sh
ENTRYPOINT ["init-secrets.sh"]
# Setting ENTRYPOINT clears the base image's CMD.
CMD ["postgres"]

# Check over TCP. During first-time init the server briefly accepts socket
# connections only, and a socket check would pass too early.
HEALTHCHECK --interval=5s --timeout=5s --start-period=10s --retries=12 \
  CMD pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" || exit 1
