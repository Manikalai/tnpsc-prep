// Prints which AI keys work (GitHub Actions side). Never prints key values.
import "./env";
import { pingProviders } from "../lib/ai";
console.log(JSON.stringify(await pingProviders(), null, 2));
