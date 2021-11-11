FROM node

WORKDIR /app

COPY . /app

RUN yarn build && mv .env-docker .env

ENTRYPOINT ["yarn", "run", "api"]
