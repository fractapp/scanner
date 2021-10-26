import { scan } from '../../src/scanner/scanner';
import { BlockStatus, Network, TxStatus } from '../../src/models/enums/status';
import {Block} from "../../src/models/db/block";
const mongoose = require('mongoose');

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
    const spyBlock = jest.spyOn(Block, 'findOne');
    const spyCreateBlock = jest.spyOn(Block, 'create');
    const spyCreateTransaction = jest.spyOn(mongoose.model('transaction'), 'create');
    const spyCreateEvent = jest.spyOn(mongoose.model('event'), 'create');

    spyCreateBlock.mockReturnValue();
    spyCreateTransaction.mockReturnValue();
    spyCreateEvent.mockReturnValue();
    spyBlock.mockReturnValue(null);

    await scan(123n, 124n, Network.Polkadot, adaptor2);

    expect(spyCreateBlock).toBeCalled();
    expect(spyCreateTransaction).toBeCalled();
    expect(spyCreateEvent).toBeCalled();
    expect(spyBlock).toBeCalledTimes(2);
    expect(adaptor2.getLastFinalizedHeight).toBeCalledTimes(1);
    expect(adaptor2.getBlock).toBeCalledTimes(2);
    expect(adaptor2.getTxsAndEvents).toBeCalledTimes(2);
    expect(adaptor2.getCurrency).toBeCalledTimes(4);
});

it('test scan 2', async () => {
    let block1 = new Block({
        hash: 'hash-123',
        number: '123',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: true
    });
    let block2 = new Block({
        hash: 'hash-124',
        number: '124',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: true
    });

    const spyCreateBlock = jest.spyOn(Block, 'create');
    const spyBlockFind = jest.spyOn(Block, 'findOne');
    const spyBlockUpdateMany = jest.spyOn(Block, 'updateMany');
    const spyBlockUpdateOne = jest.spyOn(Block, 'updateOne');


    jest.spyOn(Block, 'findOne').mockReturnValue(block1);
    jest.spyOn(Block, 'findOne').mockReturnValue(block2);
    spyCreateBlock.mockImplementation();
    spyBlockUpdateMany.mockImplementation();
    spyBlockUpdateOne.mockImplementation();

    await scan(123n, 124n, Network.Polkadot, adaptor1)

    expect(spyBlockFind).toBeCalledTimes(2);
    expect(spyBlockUpdateMany).toBeCalledTimes(1);
    expect(spyBlockUpdateOne).toBeCalledTimes(1);

    expect(adaptor1.getLastFinalizedHeight).toBeCalledTimes(1);
    expect(adaptor1.getBlock).toBeCalledTimes(2);
});
