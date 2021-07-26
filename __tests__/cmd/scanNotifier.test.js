import { scan } from '../../src/cmd/scanNotifier';
import { Currency } from '../../src/models/enums/currency';
import { BlockStatus, Network, TxStatus } from '../../src/models/enums/statuses';
import axios from 'axios';
import mockAxios from 'jest-mock-axios';

const mongoose = require('mongoose');
const mockingoose = require('mockingoose');
const modelBlock = require('../../src/models/db/block');
const modelEvent = require('../../src/models/db/event');
const modelTransaction = require('../../src/models/db/transactions');

jest.mock('axios');

afterEach(async () => {
    mockAxios.reset();
    jest.resetAllMocks();
});


it('test scanNotifier 1', async () => {
    const block = {
        hash: 'hash',
        number: '125',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: false
    };
    
    const spy = jest.spyOn(modelBlock.Block, 'findOne').mockReturnValueOnce({
        sort: jest.fn(() => block)
    });

    expect(await scan('url', 123n, Network.Polkadot)).toStrictEqual(125n);
    expect(spy).toBeCalledTimes(3);
});
it('test scanNotifier 2', async () => {
    const block = {
        hash: 'hash2',
        number: '126',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: false,
        save: jest.fn(async () => {})

    }
    const tx ={
        txId: 'txId',
        hash: 'hash',
        status: TxStatus.Fail,
        block: block,
    }
    const event = {
        eventId: 'eventId',
        block: block,
        transaction:  tx,
        from: 'from',
        to: 'to',
        fee: 'fee',
        value: 'value',
        timestamp: 12345,
        currency: Currency.DOT,
        isNotified: false,
        save: jest.fn(async () => {})
    };    

    const spyBlock = jest.spyOn(modelBlock.Block, 'findOne')
    .mockReturnValueOnce({
        sort: jest.fn(() => block)
    })
    .mockReturnValueOnce(block);
    const spyEvent = jest.spyOn(modelEvent.Event, 'find').mockReturnValueOnce({
        populate: jest.fn(() => [event])
    });

    expect(await scan('url1', 123n, Network.Polkadot)).toStrictEqual(126n);
    expect(spyBlock).toBeCalledTimes(4);
    expect(spyEvent).toBeCalledTimes(1);
});

it('test scanNotifier 3', async () => {
    const block = {
        hash: 'hash2',
        number: '126',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: false,
        save: jest.fn(async () => {})
    }
    const tx = {
        txId: 'txId',
        hash: 'hash',
        status: TxStatus.Success,
        block: block,
    }
    const event = {
        eventId: 'eventId',
        block: block,
        transaction:  tx,
        from: 'from',
        to: 'to',
        fee: 'fee',
        value: 'value',
        timestamp: 12345,
        currency: Currency.DOT,
        isNotified: false,
        save: jest.fn(async () => {})
    };    

    const spyBlock = jest.spyOn(modelBlock.Block, 'findOne')
    .mockReturnValueOnce({
        sort: jest.fn(() => block)
    })
    .mockReturnValueOnce(block);
    const spyEvent = jest.spyOn(modelEvent.Event, 'find').mockReturnValueOnce({
        populate: jest.fn(() => [event])
    });
    await axios.post.mockResolvedValue({status: 400});

    expect(await scan('url', 123n, Network.Polkadot)).toStrictEqual(126n);
    expect(spyBlock).toBeCalledTimes(5);
    expect(spyEvent).toBeCalledTimes(1);
});
it('test scanNotifier 4', async () => {
    const block = {
        hash: 'hash2',
        number: '126',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: false,
        save: jest.fn(async () => {})
    }
    const tx = {
        txId: 'txId',
        hash: 'hash',
        status: TxStatus.Success,
        block: block,
    }
    const event = {
        eventId: 'eventId',
        block: block,
        transaction:  tx,
        from: 'from',
        to: 'to',
        fee: 'fee',
        value: 'value',
        timestamp: 12345,
        currency: Currency.DOT,
        isNotified: false,
        save: jest.fn(async () => {})
    };    

    const spyBlock = jest.spyOn(modelBlock.Block, 'findOne')
    .mockReturnValueOnce({
        sort: jest.fn(() => block)
    })
    .mockReturnValueOnce(block);
    const spyEvent = jest.spyOn(modelEvent.Event, 'find').mockReturnValueOnce({
        populate: jest.fn(() => [event])
    });
    await axios.post.mockResolvedValue({status: 200});

    expect(await scan('url', 123n, Network.Polkadot)).toStrictEqual(126n);
    expect(spyBlock).toBeCalledTimes(4);
    expect(spyEvent).toBeCalledTimes(1);
});

it('test scanNotifier 5', async () => {
    const spyBlock = jest.spyOn(modelBlock.Block, 'findOne').mockReturnValueOnce({
        sort: jest.fn(() => {})
    });
    
    expect(await scan('url', 123n, Network.Polkadot)).toStrictEqual(123n);
    expect(spyBlock).toBeCalledTimes(1);
});

