FROM node

ENV network="Polkadot"
ENV defaultHeight="7647081"

WORKDIR /app

COPY . /app

RUN yarn build && mv .env-docker .env

CMD ["sh", "-c", "node ./bin/src/cmd/scanner.js ${network} ${defaultHeight}"]
