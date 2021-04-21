## Only android version

## Getting Started

1. Configure .env 
```sh
MONGODB_CONNECTION={mongodb connection string}
POLKADOT_RPC_URL={polkadot node}
KUSAMA_RPC_URL={kusama node}
SUBSCRIBER_URL={subscriber url}
HOST=localhost
PORT=3000
```

2. Install yarn packages
```sh
yarn install
```

3. Build
```sh
yarn build
```

4. Start scanner for Polkadot
```sh
yarn scanner Polkadot {default height for first launch}
```

5. Start scanner for Kusama
```sh
yarn scanner Kusama {default height for first launch}
```

6. Start notifier for Polkadot
```sh
yarn notifier Polkadot {default height for first launch}
```

7. Start notifier for Kusama
```sh
yarn notifier Kusama {default height for first launch}
```
