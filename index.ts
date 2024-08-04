import { App } from '@slack/bolt';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// This needs syncing to a DB later, KV is probably fine.
const userThreads: Record<string, Record<string, string>> = {};

const LOG_CHANNEL = 'C06T9MYV543';

app.event('message', async ({ event, client }) => {
  if (event.channel_type === 'im') { // Runs when the user messsges the bot 
    try {
      const userId = event.user;
      const dmThreadTs = event.thread_ts;

      if (!userThreads[userId]) {
        userThreads[userId] = {};
      }

      let channelThreadTs = dmThreadTs ? userThreads[userId][dmThreadTs] : undefined;

      if (dmThreadTs && !channelThreadTs) {
        const rootMessage = await client.chat.postMessage({
          channel: LOG_CHANNEL, 
          text: `New thread with <@${userId}>`
        });
        channelThreadTs = rootMessage.ts;
        userThreads[userId][dmThreadTs] = channelThreadTs;
      } else if (!dmThreadTs) {
        
        const rootMessage = await client.chat.postMessage({
          channel: LOG_CHANNEL, 
          text: `New thread with <@${userId}>`
        });
        channelThreadTs = rootMessage.ts;
        userThreads[userId][event.ts] = channelThreadTs;
      }

            await client.chat.postMessage({
        channel: LOG_CHANNEL,
        thread_ts: channelThreadTs,
        text: event.text
      });
    } catch (error) {
      console.error(error);
    }
  }
  else if (event.channel_type === 'channel' && event.channel == LOG_CHANNEL) {
    const threadTs = event.thread_ts;
    if (!threadTs) {
      // Message user from message and make new thread
    }
    else {
      const DMThreadTs = userThreads[event.user][threadTs];
      await client.chat.postMessage(
        {
          channel: event.channel,
          thread_ts: DMThreadTs,
          text: event.text
          } )
    }
  }
  
});

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');
})();