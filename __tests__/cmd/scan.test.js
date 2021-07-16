import { scan } from '../../src/cmd/scan';
import { BlockStatus, Network, TxStatus } from '../../src/models/enums/statuses';

const mockingoose = require('mockingoose');
const modelBlock = require('../../src/models/db/block');
const modelTransaction = require('../../src/models/db/transactions');
const modelEvent = require('../../src/models/db/event');

jest.mock('@polkadot/api', () => ({
    ApiPromise: {
        api:jest.fn(),
        create: jest.fn(),
    },
    WsProvider: jest.fn(),
}));

const adaptor1 = {
    getCurrency: jest.fn(),
    getLastHeight: jest.fn(),
    getLastFinalizedHeight: jest.fn(async () => {
        return 123n;
    }),
    getBlock: jest.fn(async (blockNumber) => {
        return {
            hash: `hash-${blockNumber}`,
            timestamp: 123,
            isExistInDb: true
        };
    }),
    getTxsAndEvents: jest.fn(),
    getBalance: jest.fn(),
}
const adaptor2 = {
    getCurrency: jest.fn(),
    getLastHeight: jest.fn(),
    getLastFinalizedHeight: jest.fn(async () => {
        return 123n;
    }),
    getBlock: jest.fn(async (blockNumber) => {
        return {
            hash: `hash-${blockNumber}`,
            timestamp: 123,
            isExistInDb: false,
        };
    }),
    getTxsAndEvents: jest.fn(async () => {
        const txAndEvents = [
            {
                transaction: {
                    id: 'string',
                    hash: 'string',
                    status: TxStatus.Success,
                },
                events: [
                    {
                        id: 'string',
                        from: 'string',
                        to: 'string',
                        value: 'string',
                        fee: 'string'
                    },
                ],
            },
            {
                transaction: {
                    id: 'string1',
                    hash: 'string1',
                    status: TxStatus.Success,
                },
                events: [
                    {
                        id: 'string1',
                        from: 'string1',
                        to: 'string1',
                        value: 'string1',
                        fee: 'string1'
                    },
                ],
            },
        ];
        return txAndEvents;
    }),
    getBalance: jest.fn(),
}

it('test scan 1', async () => {
    await mockingoose(modelBlock.Block).toReturn(null, 'findOne');
    await scan(123n, 124n, Network.Polkadot, adaptor2);
    expect(modelBlock.Block.create).toBeCalledTimes(1);
});
it('test scan 2', async () => {
    let block1 = new modelBlock.Block({
        hash: 'hash-123',
        number: '123',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: true
    });
    let block2 = new modelBlock.Block({
        hash: 'hash-124',
        number: '124',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: true
    });

    await mockingoose(modelBlock.Block).toReturn(block1, 'findOne');
    await mockingoose(modelBlock.Block).toReturn(block2, 'findOne');

    expect(await scan(123n, 124n, Network.Polkadot, adaptor1)).toStrictEqual('');
});

