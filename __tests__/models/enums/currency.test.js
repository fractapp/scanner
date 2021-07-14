import { Network } from "../../../src/models/enums/statuses";
import { getNativeCurrency, toCurrency, Currency } from "../../../src/models/enums/currency";

it('Currency getNativeCurrency Polkadot', async () => {
    const network = Network.Polkadot;
    expect(await getNativeCurrency(network)).toStrictEqual(Currency.DOT);
});

it('Currency getNativeCurrency Kusama', async () => {
    const network = Network.Kusama;
    expect(await getNativeCurrency(network)).toStrictEqual(Currency.KSM);
});
it('Currency getNativeCurrency default', async () => {
    const network = Network.Polkadot;
    expect(await getNativeCurrency('')).toStrictEqual(Currency.DOT);
});

it('Currency toCurrency Polkadot', async () => {
    const network = Network.Polkadot;
    expect(await toCurrency('DOT')).toStrictEqual(Currency.DOT);
});

it('Currency toCurrency Kusama', async () => {
    const network = Network.Polkadot;
    expect(await toCurrency('KSM')).toStrictEqual(Currency.KSM);
});

it('Currency toCurrency default', async () => {
    const network = Network.Polkadot;
    expect(await toCurrency('')).toStrictEqual(Currency.DOT);
});