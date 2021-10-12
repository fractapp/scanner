import {Currency} from "../models/enums/currency";
import {ApiPromise, WsProvider} from "@polkadot/api";
import * as polkaTypes from "@polkadot/types/interfaces/system/types";
import {Adaptor, Balance, Block, Event, TxAndEvents} from "./adaptor";
import {TxAction, TxStatus} from "../models/enums/status";

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

    public getBaseApi(): any {
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

    async getTxsAndEvents(blockHash: string): Promise<Array<TxAndEvents>> {
        const block = await this._api.rpc.chain.getBlock(blockHash)
        const records = await this._api.query.system.events.at(block.block.header.hash);

        const txsAndEvents: Array<TxAndEvents> = []
        for (let index = 0; index < block.block.extrinsics.length; index++) {
            const extrinsic = block.block.extrinsics[index]
            const exHash = extrinsic.hash.toHex()

            const eventRecords = records
                .filter(({phase, event}) =>
                    phase.isApplyExtrinsic &&
                    phase.asApplyExtrinsic.eq(index)
                )

            const failEvent = records
                .filter(({phase, event}) =>
                    phase.isApplyExtrinsic &&
                    phase.asApplyExtrinsic.eq(index) &&
                    this._isExFailed(event)
                )

            let error = ""
            for (const event of failEvent) {
                error += `${event.event.data[0].toString()}: ${event.event.data[1].toString()}\n`
            }
            const txAndEvents: TxAndEvents = {
                transaction: {
                    id: `${blockHash}-${index}`,
                    hash: exHash,
                    status: failEvent.length == 0 ? TxStatus.Success : TxStatus.Fail,
                    error: error
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

            for (let eventIndex = 0; eventIndex < records.length; eventIndex++) {
                const record = records[eventIndex]

                if (
                    !record.phase.isApplyExtrinsic ||
                    !record.phase.asApplyExtrinsic.eq(index)
                ) {
                    continue
                }

                const event: Event = {
                    action: TxAction.Transfer,
                    from: "0",
                    to: "0",
                    value: "0",

                    id: `${blockHash}-${eventIndex}`,
                    fee: String(fee)
                }

                if (record.event.section == 'balances' && record.event.method == 'Transfer') {
                    event.action = TxAction.Transfer
                    event.from = record.event.data[0].toString()
                    event.to = record.event.data[1].toString()
                    event.value = record.event.data[2].toString()
                } else if (record.event.section == 'staking' && record.event.method == 'Rewarded') {
                    event.action = TxAction.StakingReward
                    event.from = record.event.data[0].toString()
                    event.to = record.event.data[0].toString()
                    event.value = record.event.data[1].toString()
                } else if (record.event.section == 'staking' && record.event.method == 'Withdrawn') {
                    event.action = TxAction.StakingWithdrawn
                    event.from = record.event.data[0].toString()
                    event.to = record.event.data[0].toString()
                    event.value = record.event.data[1].toString()
                } else {
                    continue
                }

                txAndEvents.events.push(event)
            }

            txsAndEvents.push(txAndEvents)
        }

        return txsAndEvents
    }

    async getBalance(address: string): Promise<Balance> {
        const account = await this._api.query.system.account(address);
        const free = account.data.free.toBigInt()
        const reserved = account.data.reserved.toBigInt()
        const miscFrozen = account.data.miscFrozen.toBigInt()
        const feeFrozen = account.data.feeFrozen.toBigInt()

        const staking = await this._api.query.staking.ledger(address);
        return {
            total: free + reserved,
            transferable: free - miscFrozen,
            payableForFee: free - feeFrozen,
            staking: staking.isNone ? BigInt(0) : staking.unwrap().total.toBigInt()
        }
    }

    private _isExFailed(event: polkaTypes.Event): boolean {
        return (event.section == 'system' && event.method == 'ExtrinsicFailed')
    }
}
