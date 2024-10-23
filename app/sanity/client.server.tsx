import { createClient, type ClientConfig } from '@sanity/client';

const config: ClientConfig = {
  projectId: process.env.SANITY_STUDIO_PROJECT_ID,
  token: process.env.SANITY_API_KEY,
  dataset: process.env.SANITY_STUDIO_DATASET,
  useCdn: false, // set to `false` to bypass the edge cache
  apiVersion: '2023-05-03', // use current date (YYYY-MM-DD) to target the latest API version
};

export const sanityClient = createClient(config);
