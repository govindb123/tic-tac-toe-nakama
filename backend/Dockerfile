FROM heroiclabs/nakama:3.17.0

COPY modules /nakama/data/modules

ENTRYPOINT ["/bin/sh", "-ecx"]

CMD echo "Running migration..." && \
/nakama/nakama migrate up --database.address="$DB_ADDR" && \
echo "Starting Nakama..." && \
/nakama/nakama \
--name nakama1 \
--database.address="$DB_ADDR" \
--logger.level DEBUG \
--runtime.js_entrypoint match_handler.js