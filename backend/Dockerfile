FROM heroiclabs/nakama:3.17.0

COPY modules /nakama/data/modules
COPY start.sh /start.sh

RUN chmod +x /start.sh

ENTRYPOINT ["/bin/sh", "/start.sh"]
