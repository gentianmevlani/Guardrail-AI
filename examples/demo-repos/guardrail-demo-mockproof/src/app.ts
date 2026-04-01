import { getClient } from "./fakeClient.js";

async function main() {
  const client = getClient();
  const data = await client.getUser("123");
  console.log("User:", data);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
