## Getting Started

## Configure
```sh
MONGODB_CONNECTION={mongodb connection string}
POLKADOT_RPC_URL={polkadot node}
KUSAMA_RPC_URL={kusama node}
SUBSCRIBER_URL={subscriber from fractapp-server url}
HOST=localhost
PORT=3000
```

## Manual
1. Create .env config

2. Install yarn packages
```sh
yarn install
```

3. Build
```sh
yarn build
```

4. Start api
```sh
yarn api
```

5. Start scanner for Polkadot
```sh
yarn scanner Polkadot {default height for first launch}
```

6. Start scanner for Kusama
```sh
yarn scanner Kusama {default height for first launch}
```

7. Start notifier for Polkadot
```sh
yarn notifier Polkadot {default height for first launch}
```

8. Start notifier for Kusama
```sh
yarn notifier Kusama {default height for first launch}
```

9. Start notifier for Kusama
```sh
yarn notifier Kusama {default height for first launch}
```

## Docker

Config for docker is in .env-docker

```sh
docker-compose up
```

## Tests

```sh
yarn test
```
