FROM heroiclabs/nakama:3.17.0

COPY modules /nakama/data/modules

CMD ["/bin/sh", "-c", "\
echo 'DB_ADDR='$DB_ADDR && \
/nakama/nakama migrate up --database.address=\"$DB_ADDR\" && \
exec /nakama/nakama \
--name nakama1 \
--database.address=\"$DB_ADDR\" \
--logger.level DEBUG \
--runtime.js_entrypoint match_handler.js"]