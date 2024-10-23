import { sanityClient } from './client.server';

type Child = {
  _id: string;
  name: string;
  twitterUsername: string;
  status: 'naughty' | 'nice';
  score: number;
};

export async function updateChildStatusAndScore(
  twitterUsername: string,
  newStatus: 'naughty' | 'nice',
  newScore: number,
) {
  newScore = newScore < 0 ? 0 : newScore;
  const child = await fetchChildByTwitterUsername(twitterUsername);
  if (child) {
    // Update the existing child document
    await sanityClient.patch(child._id).set({ status: newStatus, score: newScore }).commit();
    console.log(`Updated child ${twitterUsername} with status: ${newStatus} and score: ${newScore}`);
  } else {
    // Create a new child document if it doesn't exist
    await sanityClient.create({
      _type: 'child',
      twitterUsername,
      status: newStatus,
      score: newScore,
    });
    console.log(`Created new child ${twitterUsername} with status: ${newStatus} and score: ${newScore}`);
  }
}

export async function fetchChildByTwitterUsername(twitterUsername: string): Promise<Child | null> {
  // Fetch the child document by name
  return sanityClient.fetch(`*[_type == "child" && twitterUsername == $twitterUsername][0]`, {
    twitterUsername,
  });
}
