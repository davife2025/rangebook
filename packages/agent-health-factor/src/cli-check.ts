// Manual smoke test — run once you have real env vars and a networked
// environment: pnpm check-once 0xSomeTestnetWallet
import { checkAaveHealthFactor } from "./monitor";

const wallet = process.argv[2] as `0x${string}` | undefined;

if (!wallet) {
  console.error("Usage: pnpm check-once <wallet-address>");
  process.exit(1);
}

checkAaveHealthFactor(wallet)
  .then((result) => {
    console.log(result);
  })
  .catch((err: Error) => {
    console.error(err.message);
    process.exit(1);
  });
