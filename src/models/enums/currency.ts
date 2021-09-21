import {Network} from "./status";

export enum Currency {
    DOT = 0,
    KSM = 1
}

export function getNativeCurrency(network: Network): Currency {
    switch (network) {
        case Network.Polkadot:
            return Currency.DOT
        case Network.Kusama:

            return Currency.KSM
    }
    return Currency.DOT
}

export function toCurrency(value: string): Currency {
    switch (value) {
        case "DOT":
            return Currency.DOT
        case "KSM":
            return Currency.KSM
    }
    return Currency.DOT
}
