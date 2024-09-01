import { App, type GenericMessageEvent } from "@slack/bolt";
import { readFileSync, writeFileSync, existsSync } from "fs";

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

interface Threads {
  [userId: string]: {
    [dmThreadTs: string]: string;
  };
}

const LOG_CHANNEL = "C06T9MYV543";

const THREADS_PATH = "./threads.json";
let threads: Threads = {};

function loadThreadsFromJson(path: string) {
  if (existsSync(path)) {
    const data = readFileSync(path, "utf-8");
    return JSON.parse(data) as Threads;
  } else {
    return {};
  }
}

function saveThreadsToJson(path: string, threads: Threads) {
  const data = JSON.stringify(threads, null, 2);
  try {
    writeFileSync(path, data, "utf-8");
    console.log("saved to json");
  } catch (err) {
    console.error("failed to write to json", err);
  }
}

threads = loadThreadsFromJson(THREADS_PATH);

interface MessageEvent extends GenericMessageEvent {
  thread_ts?: string;
  channel_type: "im" | "channel";
}

app.event("message", async ({ event, client }) => {
  const typedEvent = event as MessageEvent;
  console.log("message says hi");

  if (typedEvent.channel_type === "im") {
    // Message was sent in DM
    try {
      const userId = typedEvent.user;
      const dmThreadTs = typedEvent.thread_ts;

      threads[userId] = threads[userId] || {};

      let channelThreadTs = dmThreadTs
        ? threads[userId][dmThreadTs]
        : undefined;

      if (dmThreadTs && !channelThreadTs) {
        // New ticket
        console.log("new ticket");
        const rootMessage = await client.chat.postMessage({
          channel: LOG_CHANNEL,
          text: `New thread with <@${userId}>`,
        });
        channelThreadTs = rootMessage.ts;
        if (dmThreadTs) {
          threads[userId][dmThreadTs] = channelThreadTs as string;
        }
      } else if (!dmThreadTs) {
        console.log("NEW TICKET WITHOUT DM TS");
        const rootMessage = await client.chat.postMessage({
          channel: LOG_CHANNEL,
          text: `New thread with <@${userId}>`,
        });
        channelThreadTs = rootMessage.ts;
        if (typedEvent.ts) {
          threads[userId][typedEvent.ts] = channelThreadTs as string;
        } else {
          console.error("The timestamp for the event is undefined");
        }
      }

      // relay dm to channel
      await client.chat.postMessage({
        channel: LOG_CHANNEL,
        thread_ts: channelThreadTs,
        text: typedEvent.text,
      });

      saveThreadsToJson(THREADS_PATH, threads);
    } catch (error) {
      console.error(error);
    }
  } else if (typedEvent.channel_type === "channel") {
    if (typedEvent.channel === LOG_CHANNEL) {
      console.log("channel");
      const threadTs = typedEvent.thread_ts;
      if (!threadTs) {
        // Message in channel - probably ignore?
      } else {
        console.log("send in thread in dm");
        const dmUserThreads = Object.entries(threads).find(
          ([userId, threads]) => Object.values(threads).includes(threadTs),
        );
        if (dmUserThreads) {
          const [userId, threads] = dmUserThreads;
          const dmThreadTs = Object.keys(threads).find(
            (key) => threads[key] === threadTs,
          );

          if (dmThreadTs) {
            await client.chat.postMessage({
              channel: userId, // User's Slack ID for DM
              thread_ts: dmThreadTs,
              text: typedEvent.text,
            });
          }
        }
      }
    } else if (typedEvent.thread_ts) {
      console.log("mesasge in thread in normal channel");
      return;
    }
  }
});

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log("⚡️ Bolt app is running!");
})();
