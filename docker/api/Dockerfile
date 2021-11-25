FROM node

WORKDIR /app

COPY . /app

RUN yarn install && yarn build && mv .env-docker .env

ENTRYPOINT ["yarn", "run", "api"]
