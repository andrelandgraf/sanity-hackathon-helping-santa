import { sanityClient } from './client.server';

async function fetchChildren() {
  const data = await sanityClient.fetch(``);
}
