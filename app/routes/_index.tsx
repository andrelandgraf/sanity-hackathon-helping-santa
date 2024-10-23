import { generateObject } from 'ai';
import zod from 'zod';
import { openai } from '@ai-sdk/openai'; // Ensure OPENAI_API_KEY environment variable is set
import { ExternalLinkIcon, Search, ThumbsDownIcon, ThumbsUpIcon, XIcon } from 'lucide-react';
import { Button, ButtonAnchor } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Form, MetaFunction, useLoaderData, useNavigation } from '@remix-run/react';
import { LoaderFunctionArgs } from '@remix-run/node';
import { fetchTwitterProfile, fetchTweetsFromUser, PartialTweet } from '~/twitter/api.server';
import { Progress } from '~/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import cachified from '@epic-web/cachified';
import { lru } from '~/cache/cache.server';
import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { DialogDescription } from '@radix-ui/react-dialog';

export const meta: MetaFunction = () => {
  return [{ title: 'Santa Dashboard' }];
};

type LoaderData = null | {
  name: string;
  twitterUsername: string;
  imageUrl: string;
  imageFallback: string;
  results: {
    most_positive_tweet_id: string;
    most_negative_tweet_id: string;
    rating: 'nice' | 'naughty';
    score: number;
    niceTweet: PartialTweet;
    naughtyTweet: PartialTweet;
  };
  tweets: PartialTweet[];
};

export async function loader({ request }: LoaderFunctionArgs): Promise<null | LoaderData | Response> {
  const url = new URL(request.url);
  let twitterUsername = url.searchParams.get('twitterUsername');
  if (!twitterUsername || typeof twitterUsername !== 'string') {
    return null;
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
          tweets,
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
  const data = useLoaderData<typeof loader>() as LoaderData;
  const navigation = useNavigation();
  const loading = navigation.state === 'loading' || (navigation.state === 'submitting' && !!navigation.formData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentTweetIndex, setCurrentTweetIndex] = useState(0);

  const handleSwipe = (direction: 'left' | 'right') => {
    if (!data) return;
    if (currentTweetIndex < data.tweets.length - 1) {
      setCurrentTweetIndex(currentTweetIndex + 1);
    } else {
      setIsDialogOpen(false);
      setCurrentTweetIndex(0);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleSwipe('left'),
    onSwipedRight: () => handleSwipe('right'),
    trackMouse: true,
  });

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

      {!!data && (
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
                <ButtonAnchor
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://x.com/${data.twitterUsername}/status/${data.results.niceTweet.id}`}
                >
                  View Tweet
                  <ExternalLinkIcon className="ml-2 h-4 w-4" />
                </ButtonAnchor>
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
                <ButtonAnchor
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://x.com/${data.twitterUsername}/status/${data.results.naughtyTweet.id}`}
                >
                  View Tweet
                  <ExternalLinkIcon className="ml-2 h-4 w-4" />
                </ButtonAnchor>
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

          <div className="mt-8 text-center">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>Categorize Tweets</Button>
              </DialogTrigger>
              <DialogContent className="md:min-w-[800px]">
                <DialogHeader>
                  <DialogTitle>Categorize Tweets</DialogTitle>
                  <DialogDescription>
                    Checking the tweets of @{data.twitterUsername} as nice or naughty.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4" {...swipeHandlers}>
                  <Card className="relative overflow-hidden">
                    <CardContent className="p-6">
                      <p className="text-lg mb-4">{data.tweets[currentTweetIndex].full_text}</p>
                      <ButtonAnchor
                        size="sm"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://x.com/${data.twitterUsername}/status/${data.tweets[currentTweetIndex].id}`}
                      >
                        View Tweet
                        <ExternalLinkIcon className="ml-2 h-4 w-4" />
                      </ButtonAnchor>
                    </CardContent>
                  </Card>
                  <p className="mt-2 text-muted-foreground text-sm">Swipe left for naughty or right for nice</p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </>
      )}
    </div>
  );
}
