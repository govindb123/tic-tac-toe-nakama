CMD ["/bin/sh", "-c", "\
echo '====== DB_ADDR VALUE ======' && \
echo $DB_ADDR && \
echo '===========================' && \
/nakama/nakama migrate up --database.address=\"$DB_ADDR\" && \
exec /nakama/nakama \
--name nakama1 \
--database.address=\"$DB_ADDR\" \
--logger.level DEBUG \
--runtime.js_entrypoint match_handler.js"]