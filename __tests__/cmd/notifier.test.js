import { notify } from '../../src/notifier/notifier';
import { Currency } from '../../src/models/enums/currency';
import { BlockStatus, Network, TxStatus } from '../../src/models/enums/status';
import axios from 'axios';
import mockAxios from 'jest-mock-axios';
import {Block} from "../../src/models/db/block";
import {Event} from "../../src/models/db/event";

jest.mock('axios');

afterEach(async () => {
    mockAxios.reset();
    jest.resetAllMocks();
});

it('test notify lastNotifiedHeight < lastBlock.number', async () => {
    const block = {
        hash: 'hash',
        number: '125',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: false
    };
    const spy = jest.spyOn(Block, 'findOne')

    spy.mockReturnValueOnce({
        sort: jest.fn(() => block)
    });

    expect(await notify('url', 127n, Network.Polkadot)).toStrictEqual(127n);
    expect(spy).toBeCalledTimes(1);
});

it('test notify (block is notified)', async () => {
    const saveMock = jest.fn()
    const block = {
        hash: 'hash2',
        number: '123',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: true,
        save: saveMock
    }

    const spyBlock = jest.spyOn(Block, 'findOne')
    .mockReturnValueOnce({
        sort: jest.fn(() => block)
    })
    .mockReturnValueOnce(block);

    expect(await notify('url1', 122n, Network.Polkadot)).toStrictEqual(123n);
    expect(spyBlock).toBeCalledTimes(2);
    expect(saveMock).not.toBeCalled()
});

it('test notify', async () => {
    const saveBlock = jest.fn()
    const saveEvent = jest.fn()
    const block = {
        hash: 'hash2',
        number: '126',
        status: BlockStatus.Success,
        network: Network.Polkadot,
        isNotified: false,
        save: saveBlock
    }
    const txs = [
        {
            txId: 'txId1',
            hash: 'hash1',
            status: TxStatus.Success,
            block: block,
        },
        {
            txId: 'txId2',
            hash: 'hash2',
            status: TxStatus.Fail,
            block: block,
        }
    ]
    const event = {
        eventId: 'eventId',
        block: block,
        transaction: txs[0],
        from: 'from',
        to: 'to',
        fee: 'fee',
        value: 'value',
        timestamp: 12345,
        currency: Currency.DOT,
        isNotified: false,
        save: saveEvent
    }

    const spyBlock = jest.spyOn(Block, 'findOne')
    .mockReturnValueOnce({
        sort: jest.fn(() => block)
    })
    .mockReturnValueOnce(block).mockReturnValueOnce(block);

    const spyEvent = jest.spyOn(Event, 'find').mockReturnValue({
        populate: jest.fn(() => [event])
    });
    await axios.post.mockResolvedValueOnce({status: 400});
    await axios.post.mockResolvedValueOnce({status: 200});

    expect(await notify('url', 125n, Network.Polkadot)).toStrictEqual(126n);
    expect(axios.post).toBeCalledWith(`url/notify`, {
        from: event.from,
        to: event.to,
        value: event.value,
        currency: event.currency
    })
    expect(spyBlock).toBeCalledTimes(3);
    expect(spyEvent).toBeCalledTimes(2);
    expect(block.isNotified).toEqual(true)
    expect(event.isNotified).toEqual(true)
    expect(saveBlock).toBeCalledTimes(1)
    expect(saveEvent).toBeCalledTimes(1)
});
