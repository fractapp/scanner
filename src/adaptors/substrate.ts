import {Currency} from "../models/enums/currency";
import {ApiPromise, WsProvider} from "@polkadot/api";
import * as polkaTypes from "@polkadot/types/interfaces/system/types";
import {Adaptor, Block, TxAndEvents, Event} from "./adaptor";
import {TxStatus} from "../models/enums/statuses";

export class SubstrateAdaptor implements Adaptor {
    private readonly _currency: Currency;
    private readonly _api: ApiPromise;

    constructor(api: ApiPromise, currency: Currency) {
        this._currency = currency
        this._api = api
    }

    public static getInstance(wssUrl: string, currency: Currency): Promise<SubstrateAdaptor> {
        return (async () => {
            const wsProvider = new WsProvider(wssUrl);
            return new SubstrateAdaptor(await ApiPromise.create({provider: wsProvider}), currency)
        })()
    }

    public getApi(): ApiPromise {
        return this._api
    }

    getCurrency(): Currency {
        return this._currency
    }

    async getLastHeight(): Promise<bigint> {
        const lastNotFinalizedHeader = await this._api.rpc.chain.getHeader()
        return lastNotFinalizedHeader.number.toBigInt()
    }

    async getLastFinalizedHeight(): Promise<bigint> {
        const lastFinalizedHead = await this._api.rpc.chain.getFinalizedHead()
        const lastFinalizedHeader = await this._api.rpc.chain.getHeader(lastFinalizedHead)
        const lastFinalizedHeight = lastFinalizedHeader.number.toBigInt()

        return lastFinalizedHeight
    }

    async getBlock(height: bigint): Promise<Block> {
        const hash = await this._api.rpc.chain.getBlockHash(height);
        const timestamp = await this._api.query.timestamp.now.at(hash);
        return {
            height: height,
            hash: hash.toHex(),
            timestamp: timestamp.toNumber()
        }
    }

    async getTxsAndEvents(hash: string): Promise<Array<TxAndEvents>> {
        const block = await this._api.rpc.chain.getBlock(hash)
        const records = await this._api.query.system.events.at(block.block.header.hash);

        const eventIdPrefix = block.block.hash.toHex()

        const txsAndEvents: Array<TxAndEvents> = []
        for (let index = 0; index < block.block.extrinsics.length; index++) {
            const hash = block.block.extrinsics[index].hash.toHex()

            const eventRecords = records
                .filter(({phase, event}) =>
                    phase.isApplyExtrinsic &&
                    phase.asApplyExtrinsic.eq(index) &&
                    this._isTransferEvent(event)
                )

            const failEvent = records
                .filter(({phase, event}) =>
                    phase.isApplyExtrinsic &&
                    phase.asApplyExtrinsic.eq(index) &&
                    this._isExFailed(event)
                )

            const txAndEvents: TxAndEvents = {
                transaction: {
                    hash: hash,
                    status: failEvent.length == 0 ? TxStatus.Success : TxStatus.Fail
                },
                events: []
            }

            if (eventRecords.length == 0) {
                txsAndEvents.push(txAndEvents)
                continue
            }

            let fee: bigint = BigInt(0)
            for (let record of eventRecords) {
                if (record.event.section == 'balances' && record.event.method == 'Deposit') {
                    fee += BigInt(record.event.data[1].toHex())
                } else if (record.event.section == 'treasury' && record.event.method == 'Deposit') {
                    fee += BigInt(record.event.data[0].toHex())
                }
            }

            for (let eventIndex = 0; eventIndex < eventRecords.length; eventIndex++) {
                const record = eventRecords[eventIndex]
                if (record.event.section != 'balances' || record.event.method != 'Transfer') {
                    continue
                }


                const eventId = `${eventIdPrefix}-${index}-${eventIndex}`

                txAndEvents.events.push({
                    id: eventId,
                    hash: hash,
                    from: record.event.data[0].toString(),
                    to: record.event.data[1].toString(),
                    value: record.event.data[2].toString(),
                    fee: String(fee),
                })
            }

            txsAndEvents.push(txAndEvents)
        }

        return txsAndEvents
    }

    async getBalance(address: string): Promise<bigint> {
        const account = await this._api.query.system.account(address);
        return account.data.free.toBigInt()
    }

    private _isTransferEvent(event: polkaTypes.Event): boolean {
        return (event.section == 'balances' && event.method == 'Transfer') ||
            (event.section == 'balances' && event.method == 'Deposit') ||
            (event.section == 'treasury' && event.method == 'Deposit')
    }

    private _isExFailed(event: polkaTypes.Event): boolean {
        return (event.section == 'system' && event.method == 'ExtrinsicFailed')
    }
}
