import { generateObject } from 'ai';
import zod from 'zod';
import { openai } from '@ai-sdk/openai'; // Ensure OPENAI_API_KEY environment variable is set
import { ExternalLinkIcon, Search, ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Form, MetaFunction, NavLink, useLoaderData, useNavigation } from '@remix-run/react';
import { LoaderFunctionArgs } from '@remix-run/node';
import { fetchTwitterProfile, fetchTweetsFromUser } from '~/twitter/api.server';
import { Progress } from '~/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import cachified from '@epic-web/cachified';
import { lru } from '~/cache/cache.server';

export const meta: MetaFunction = () => {
  return [{ title: 'Santa Dashboard' }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  let twitterUsername = url.searchParams.get('twitterUsername');
  if (!twitterUsername || typeof twitterUsername !== 'string') {
    return {};
  }
  if (twitterUsername.startsWith('@')) {
    twitterUsername = twitterUsername.slice(1);
  }
  return cachified({
    cache: lru,
    key: twitterUsername,
    // One day cache
    ttl: 60 * 60 * 24,
    getFreshValue: async () => {
      try {
        const res = await fetchTwitterProfile(twitterUsername);
        if (!res) {
          return new Response('No user found', { status: 404 });
        }
        const { name, profile_image_url_https } = res;
        const tweets = await fetchTweetsFromUser(twitterUsername);
        const { object: results } = await generateObject({
          model: openai('gpt-4-turbo'),
          schema: zod.object({
            most_positive_tweet_id: zod.string(),
            most_negative_tweet_id: zod.string(),
            rating: zod.enum(['nice', 'naughty']),
            score: zod.number().min(0).max(100),
          }),
          prompt: `
        You are a friendly assistant for Santa Claus! You are helping Santa Claus to figure out if a kid is nice or naughty based on their tweets.
        Santa has trouble understanding sarcasm and internet jargon, so he needs your help to analyze the tweets of @${twitterUsername}.
        Pick the most positive and most negative tweets from the list below and rate the child as nice or naughty, based on overall sentiment.
        
        Here are the latest tweets:
        ${tweets.map((tweet) => `[Tweet Id: ${tweet.id}] ${tweet.full_text}`).join('\n')}
      `,
        });

        const niceTweet = tweets.find((tweet) => tweet.id === results.most_positive_tweet_id);
        const naughtyTweet = tweets.find((tweet) => tweet.id === results.most_negative_tweet_id);
        if (!niceTweet || !naughtyTweet) {
          return new Response('Could not find nice or naughty tweet', { status: 404 });
        }

        return {
          twitterUsername,
          name,
          imageFallback: name
            .split(' ')
            .slice(0, 2)
            .map((name: string) => name[0])
            .join(''),
          imageUrl: profile_image_url_https,
          results: { ...results, niceTweet, naughtyTweet },
        };
      } catch (error) {
        console.error(error);
        return new Response('An error occurred', { status: 500 });
      }
    },
  });
}

export default function SantaDashboard() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const loading = navigation.state === 'loading' || (navigation.state === 'submitting' && !!navigation.formData);
  return (
    <div className="container mx-auto p-4">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-red-600">
            Santa's Naughty or Nice Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form className="flex space-x-2">
            <Input name="twitterUsername" type="text" placeholder="Enter Twitter username" className="flex-grow" />
            <Button type="submit" disabled={loading}>
              {loading ? 'Checking...' : 'Check'}
              <Search className="ml-2 h-4 w-4" />
            </Button>
          </Form>
        </CardContent>
      </Card>

      {!!data.name && (
        <>
          <Card className="mb-8">
            <CardContent className="flex items-center space-x-4 py-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={data.imageUrl} alt={data.name} />
                <AvatarFallback>{data.imageFallback}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold">{data.name}</h2>
                <p className="text-muted-foreground">@{data.twitterUsername}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ThumbsUpIcon className="mr-2 text-green-500" />
                  Nicest Tweet
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-green-600">{data.results.niceTweet.full_text}</p>
              </CardContent>
              <CardFooter>
                <NavLink
                  target="_blank"
                  rel="noopener noreferrer"
                  to={`https://x.com/${data.twitterUsername}/status/${data.results.niceTweet.id}`}
                >
                  View Tweet
                  <ExternalLinkIcon className="ml-2 h-4 w-4" />
                </NavLink>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ThumbsDownIcon className="mr-2 text-red-500" />
                  Naughtiest Tweet
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-600">{data.results.naughtyTweet.full_text}</p>
              </CardContent>
              <CardFooter>
                <NavLink
                  target="_blank"
                  rel="noopener noreferrer"
                  to={`https://x.com/${data.twitterUsername}/status/${data.results.naughtyTweet.id}`}
                >
                  View Tweet
                  <ExternalLinkIcon className="ml-2 h-4 w-4" />
                </NavLink>
              </CardFooter>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Overall Nice Score for {data.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={data.results.score} className="w-full" />
                <p className="mt-2 text-center font-semibold">{data.results.score.toFixed(1)}% Nice</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
